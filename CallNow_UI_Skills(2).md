# UI Skills — CallNow CRM Design System

Reusable UI style guide extracted from CallNow CRM. Copy these patterns into other projects to maintain visual consistency.

---

## 1. Design Tokens

All tokens live in CSS custom properties on `:root` and `[data-bs-theme="dark"]`.

```css
:root,
[data-bs-theme="light"] {
    /* Backgrounds */
    --bg: #fafafa;
    --bg-alt: #f5f5f5;
    --surface: #ffffff;
    --surface-2: #f9fafb;

    /* Borders */
    --border: #e5e7eb;
    --border-strong: #d4d4d8;

    /* Ink / text */
    --ink: #0a0a0a;
    --ink-soft: #525252;
    --ink-muted: #a3a3a3;

    /* Brand accent */
    --accent: #5e6ad2;
    --accent-hover: #4e5cd2;
    --accent-soft: rgba(94, 106, 210, 0.08);
    --accent-soft-strong: rgba(94, 106, 210, 0.14);

    /* Semantic colors */
    --success: #10b981;
    --success-soft: rgba(16, 185, 129, 0.10);
    --warning: #f59e0b;
    --warning-soft: rgba(245, 158, 11, 0.10);
    --danger: #ef4444;
    --danger-soft: rgba(239, 68, 68, 0.10);
    --info: #0ea5e9;
    --info-soft: rgba(14, 165, 233, 0.10);
    --purple: #7c3aed;
    --purple-soft: rgba(124, 58, 237, 0.10);

    /* Shadows */
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
    --shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.03);
    --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.04);

    /* Radius */
    --radius: 0.5rem;
    --radius-lg: 0.75rem;
    --radius-xl: 1rem;

    /* Layout */
    --sidebar-width: 240px;
    --sidebar-width-collapsed: 64px;
    --topbar-height: 56px;
}
```

### Dark mode overrides

```css
[data-bs-theme="dark"] {
    --bg: #0a0a0a;
    --bg-alt: #0f0f0f;
    --surface: #111111;
    --surface-2: #1a1a1a;
    --border: #262626;
    --border-strong: #404040;
    --ink: #fafafa;
    --ink-soft: #a3a3a3;
    --ink-muted: #737373;
    --accent: #7c8cff;
    --accent-hover: #9aa8ff;
    --accent-soft: rgba(124, 140, 255, 0.12);
    --accent-soft-strong: rgba(124, 140, 255, 0.20);
    --success: #34d399;
    --success-soft: rgba(52, 211, 153, 0.14);
    --warning: #fbbf24;
    --warning-soft: rgba(251, 191, 36, 0.14);
    --danger: #f87171;
    --danger-soft: rgba(248, 113, 113, 0.14);
    --info: #38bdf8;
    --info-soft: rgba(56, 189, 248, 0.14);
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
    --shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5), 0 2px 4px rgba(0, 0, 0, 0.3);
    --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.6), 0 4px 8px rgba(0, 0, 0, 0.4);
}
```

### Bootstrap overrides

```css
:root,
[data-bs-theme="light"] {
    --bs-body-bg: var(--bg);
    --bs-body-color: var(--ink);
    --bs-border-color: var(--border);
    --bs-link-color: var(--accent);
    --bs-link-hover-color: var(--accent-hover);
    --bs-primary: var(--accent);
    --bs-primary-rgb: 94, 106, 210;
    --bs-secondary-color: var(--ink-soft);
    --bs-tertiary-color: var(--ink-muted);
    --bs-tertiary-bg: var(--surface-2);
}

[data-bs-theme="dark"] {
    --bs-body-bg: var(--bg);
    --bs-body-color: var(--ink);
    --bs-border-color: var(--border);
    --bs-link-color: var(--accent);
    --bs-link-hover-color: var(--accent-hover);
    --bs-primary: var(--accent);
    --bs-primary-rgb: 124, 140, 255;
    --bs-secondary-color: var(--ink-soft);
    --bs-tertiary-color: var(--ink-muted);
    --bs-tertiary-bg: var(--surface-2);
}
```

---

## 2. Typography

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

html, body {
    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-feature-settings: "cv11", "ss01", "ss03";
    background: var(--bg);
    color: var(--ink);
    font-size: 14px;
    line-height: 1.5;
}

h1, h2, h3, h4, h5, h6,
.h1, .h2, .h3, .h4, .h5, .h6 {
    font-family: 'Inter', system-ui, sans-serif;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--ink);
}

h1 { font-size: 1.5rem; font-weight: 700; }
h2 { font-size: 1.25rem; }
h3 { font-size: 1.125rem; }
h4 { font-size: 1rem; }

a { color: var(--accent); text-decoration: none; }
a:hover { color: var(--accent-hover); }

::selection {
    background: var(--accent-soft-strong);
    color: var(--ink);
}
```

---

## 3. Layout System

### App shell

```css
.app-shell {
    display: flex;
    min-height: 100vh;
    background: var(--bg);
}

.app-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    margin-left: var(--sidebar-width);
    transition: margin-left 0.2s ease;
}

body[data-sidebar="collapsed"] .app-main {
    margin-left: var(--sidebar-width-collapsed);
}

@media (max-width: 991.98px) {
    .app-main { margin-left: 0; }
    body[data-sidebar="mobile-open"] .app-main { margin-left: 0; }
}

.app-content {
    flex: 1;
    padding: 1.5rem;
    max-width: 100%;
}

@media (min-width: 1400px) {
    .app-content { padding: 2rem 2.5rem; }
}
```

### Sidebar

```css
.app-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: var(--sidebar-width);
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    z-index: 1030;
    transition: width 0.2s ease, transform 0.2s ease;
    overflow: hidden;
}

body[data-sidebar="collapsed"] .app-sidebar {
    width: var(--sidebar-width-collapsed);
}

@media (max-width: 991.98px) {
    .app-sidebar {
        transform: translateX(-100%);
        box-shadow: none;
    }
    body[data-sidebar="mobile-open"] .app-sidebar {
        transform: translateX(0);
        box-shadow: 0 0 48px rgba(0, 0, 0, 0.2);
    }
}

.sidebar-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1025;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
    animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
}

body[data-sidebar="mobile-open"] {
    overflow: hidden;
}

.app-sidebar-brand {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0 1rem;
    height: var(--topbar-height);
    border-bottom: 1px solid var(--border);
    color: var(--ink);
    font-weight: 700;
    font-size: 0.9375rem;
    letter-spacing: -0.01em;
    flex-shrink: 0;
}

.app-sidebar-brand .brand-mark {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    background: var(--accent);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    flex-shrink: 0;
}

.app-sidebar-brand .brand-mark .brand-logo-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 6px;
    background: #fff;
    padding: 2px;
}

body[data-sidebar="collapsed"] .app-sidebar-brand .brand-text,
body[data-sidebar="collapsed"] .app-sidebar-section-label,
body[data-sidebar="collapsed"] .app-sidebar-link .link-text,
body[data-sidebar="collapsed"] .app-sidebar-link .link-badge {
    display: none;
}

body[data-sidebar="collapsed"] .app-sidebar-link {
    justify-content: center;
    padding: 0.5rem;
}

.app-sidebar-nav {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.75rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

.app-sidebar-section {
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.app-sidebar-section-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    padding: 0 0.75rem;
    margin-bottom: 0.25rem;
}

.app-sidebar-link {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.4375rem 0.75rem;
    border-radius: var(--radius);
    color: var(--ink-soft);
    font-size: 0.8125rem;
    font-weight: 500;
    text-decoration: none;
    transition: background 0.12s ease, color 0.12s ease;
    position: relative;
    white-space: nowrap;
}

.app-sidebar-link i,
.app-sidebar-link .icon {
    font-size: 0.9375rem;
    width: 1.125rem;
    text-align: center;
    flex-shrink: 0;
    color: var(--ink-muted);
    transition: color 0.12s ease;
}

.app-sidebar-link:hover {
    background: var(--surface-2);
    color: var(--ink);
}

.app-sidebar-link:hover i,
.app-sidebar-link:hover .icon {
    color: var(--ink-soft);
}

.app-sidebar-link.active {
    background: var(--accent-soft);
    color: var(--accent);
}

.app-sidebar-link.active i,
.app-sidebar-link.active .icon {
    color: var(--accent);
}

.app-sidebar-footer {
    border-top: 1px solid var(--border);
    padding: 0.5rem;
    flex-shrink: 0;
}
```

### Topbar

```css
.app-topbar {
    position: sticky;
    top: 0;
    z-index: 1020;
    height: var(--topbar-height);
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 1.25rem;
    gap: 0.75rem;
    flex-shrink: 0;
}

.app-topbar-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--ink-soft);
    border-radius: var(--radius);
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.app-topbar-toggle:hover {
    background: var(--surface-2);
    color: var(--ink);
    border-color: var(--border-strong);
}

.app-topbar-search {
    flex: 1;
    max-width: 480px;
    position: relative;
}

.app-topbar-search input {
    width: 100%;
    height: 32px;
    padding: 0 0.75rem 0 2.125rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: var(--radius);
    color: var(--ink);
    font-size: 0.8125rem;
    font-family: inherit;
    transition: border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
}

.app-topbar-search input::placeholder { color: var(--ink-muted); }

.app-topbar-search input:focus {
    outline: none;
    border-color: var(--accent);
    background: var(--surface);
    box-shadow: 0 0 0 3px var(--accent-soft);
}

.app-topbar-search i {
    position: absolute;
    left: 0.6875rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--ink-muted);
    font-size: 0.875rem;
    pointer-events: none;
}

.app-topbar-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.app-topbar-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--ink-soft);
    border-radius: var(--radius);
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
    font-size: 0.9375rem;
    text-decoration: none;
}

.app-topbar-icon-btn:hover {
    background: var(--surface-2);
    color: var(--ink);
}

.app-topbar-divider {
    width: 1px;
    height: 24px;
    background: var(--border);
    margin: 0 0.25rem;
}

.app-topbar-user {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.625rem 0.25rem 0.25rem;
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 999px;
    color: var(--ink);
    text-decoration: none;
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease;
    font-size: 0.8125rem;
}

.app-topbar-user:hover {
    background: var(--surface-2);
    border-color: var(--border-strong);
    color: var(--ink);
}

.app-topbar-avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
    flex-shrink: 0;
}

.app-topbar-user-name {
    font-weight: 500;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.app-topbar-user-caret {
    font-size: 0.625rem;
    color: var(--ink-muted);
}

@media (max-width: 575.98px) {
    .app-topbar-search, .app-topbar-user-name { display: none; }
}
```

---

## 4. Page Header

```css
.page-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
}

.page-header-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--ink);
    margin: 0;
    letter-spacing: -0.01em;
}

.page-header-subtitle {
    font-size: 0.8125rem;
    color: var(--ink-soft);
    margin: 0;
}

.page-header-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
```

---

## 5. Buttons

```css
.btn {
    font-family: inherit;
    font-weight: 500;
    font-size: 0.8125rem;
    border-radius: var(--radius);
    padding: 0.4375rem 0.875rem;
    line-height: 1.2;
    transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease;
    border: 1px solid transparent;
    box-shadow: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4375rem;
    cursor: pointer;
}

.btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-soft);
}

.btn-sm {
    padding: 0.3125rem 0.625rem;
    font-size: 0.75rem;
    border-radius: var(--radius);
}

.btn-lg {
    padding: 0.625rem 1.125rem;
    font-size: 0.9375rem;
    border-radius: var(--radius-lg);
}

.btn-primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
}

.btn-primary:hover, .btn-primary:focus {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
    color: #fff;
}

.btn-gradient {
    background: linear-gradient(135deg, var(--accent), var(--accent-2, #8b5cf6));
    border: none;
    color: #fff;
    box-shadow: 0 0.25rem 0.75rem rgba(94, 106, 210, 0.25);
}

.btn-gradient:hover, .btn-gradient:focus {
    color: #fff;
    filter: brightness(1.05);
    box-shadow: 0 0.375rem 1rem rgba(94, 106, 210, 0.35);
}

.btn-secondary {
    background: var(--surface-2);
    border-color: var(--border);
    color: var(--ink);
}

.btn-secondary:hover, .btn-secondary:focus {
    background: var(--bg-alt);
    border-color: var(--border-strong);
    color: var(--ink);
}

.btn-success {
    background: var(--success);
    border-color: var(--success);
    color: #fff;
}

.btn-danger {
    background: var(--danger);
    border-color: var(--danger);
    color: #fff;
}

.btn-warning {
    background: var(--warning);
    border-color: var(--warning);
    color: #1a1a1a;
}

.btn-info {
    background: var(--info);
    border-color: var(--info);
    color: #fff;
}

.btn-outline-primary {
    background: transparent;
    border-color: var(--border);
    color: var(--ink);
}

.btn-outline-primary:hover, .btn-outline-primary:focus {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent);
}

.btn-outline-secondary {
    background: transparent;
    border-color: var(--border);
    color: var(--ink-soft);
}

.btn-outline-secondary:hover, .btn-outline-secondary:focus {
    background: var(--surface-2);
    border-color: var(--border-strong);
    color: var(--ink);
}

.btn-outline-danger {
    background: transparent;
    border-color: var(--border);
    color: var(--danger);
}

.btn-outline-danger:hover, .btn-outline-danger:focus {
    background: var(--danger-soft);
    border-color: var(--danger);
    color: var(--danger);
}

.btn-ghost {
    background: transparent;
    border-color: transparent;
    color: var(--ink-soft);
}

.btn-ghost:hover, .btn-ghost:focus {
    background: var(--surface-2);
    color: var(--ink);
}

.btn-link {
    color: var(--accent);
    text-decoration: none;
    padding: 0;
    background: transparent;
    border: none;
}

.btn-link:hover {
    color: var(--accent-hover);
    text-decoration: underline;
}
```

---

## 6. Cards

```css
.card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    color: var(--ink);
}

.card-body { padding: 1.25rem; }

.card-header {
    background: transparent;
    border-bottom: 1px solid var(--border);
    padding: 0.875rem 1.25rem;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--ink);
}

.card-header:first-child {
    border-top-left-radius: var(--radius-lg);
    border-top-right-radius: var(--radius-lg);
}

.card-footer {
    background: transparent;
    border-top: 1px solid var(--border);
    padding: 0.875rem 1.25rem;
}
```

### Metric card (dashboard KPI)

```css
.metric-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 1.125rem 1.25rem;
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    box-shadow: var(--shadow);
    transition: border-color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease;
    height: 100%;
}

.metric-card:hover {
    border-color: var(--border-strong);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
}

.metric-card-icon {
    width: 36px;
    height: 36px;
    border-radius: var(--radius);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    background: var(--accent-soft);
    color: var(--accent);
    flex-shrink: 0;
}

.metric-card-icon.success { background: var(--success-soft); color: var(--success); }
.metric-card-icon.warning { background: var(--warning-soft); color: var(--warning); }
.metric-card-icon.danger  { background: var(--danger-soft);  color: var(--danger); }
.metric-card-icon.info    { background: var(--info-soft);    color: var(--info); }

.metric-card-body { min-width: 0; flex: 1; }
.metric-card-label { font-size: 0.75rem; font-weight: 500; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.125rem; }
.metric-card-value { font-size: 1.5rem; font-weight: 600; color: var(--ink); line-height: 1.1; letter-spacing: -0.02em; }
.metric-card-sub   { font-size: 0.75rem; color: var(--ink-muted); margin-top: 0.25rem; }

.metric-card-trend {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.125rem 0.4375rem;
    border-radius: 999px;
    margin-top: 0.5rem;
}

.metric-card-trend.up   { background: var(--success-soft); color: var(--success); }
.metric-card-trend.down { background: var(--danger-soft);  color: var(--danger); }
.metric-card-trend.flat { background: var(--surface-2);     color: var(--ink-soft); }
```

### Stat card

```css
.stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 1.125rem 1.25rem;
    box-shadow: var(--shadow);
    height: 100%;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: border-color 0.12s ease, box-shadow 0.12s ease;
}

.stat-card:hover { border-color: var(--border-strong); box-shadow: var(--shadow-md); }

.stat-card-icon { width: 44px; height: 44px; border-radius: var(--radius); background: var(--accent-soft); color: var(--accent); display: inline-flex; align-items: center; justify-content: center; font-size: 1.125rem; flex-shrink: 0; }
.stat-card.success .stat-card-icon { background: var(--success-soft); color: var(--success); }
.stat-card.warning .stat-card-icon { background: var(--warning-soft); color: var(--warning); }
.stat-card.danger  .stat-card-icon { background: var(--danger-soft);  color: var(--danger); }
.stat-card.info    .stat-card-icon { background: var(--info-soft);    color: var(--info); }

.stat-card-value { font-size: 1.5rem; font-weight: 600; line-height: 1; letter-spacing: -0.02em; color: var(--ink); }
.stat-card-label { font-size: 0.75rem; color: var(--ink-soft); margin-top: 0.25rem; font-weight: 500; }
```

---

## 7. Forms

```css
.form-control, .form-select {
    font-family: inherit;
    font-size: 0.8125rem;
    font-weight: 400;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--ink);
    border-radius: var(--radius);
    padding: 0.4375rem 0.75rem;
    line-height: 1.3;
    box-shadow: none;
    transition: border-color 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
}

.form-control::placeholder { color: var(--ink-muted); }

.form-control:focus, .form-select:focus {
    border-color: var(--accent);
    background: var(--surface);
    color: var(--ink);
    box-shadow: 0 0 0 3px var(--accent-soft);
    outline: none;
}

.form-control:disabled, .form-control[readonly] {
    background: var(--surface-2);
    color: var(--ink-soft);
}

.input-group-text {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--ink-soft);
    font-size: 0.8125rem;
    border-radius: var(--radius);
}

.form-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--ink-soft);
    margin-bottom: 0.3125rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

.form-check-input {
    background-color: var(--surface);
    border-color: var(--border-strong);
    border-radius: 3px;
    width: 1em;
    height: 1em;
}

.form-check-input:checked {
    background-color: var(--accent);
    border-color: var(--accent);
}

.form-check-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
}

.form-check-label {
    font-size: 0.8125rem;
    color: var(--ink);
    font-weight: 400;
}
```

---

## 8. Tables

```css
.table {
    --bs-table-bg: transparent;
    --bs-table-color: var(--ink);
    --bs-table-striped-bg: var(--surface-2);
    --bs-table-striped-color: var(--ink);
    --bs-table-hover-bg: var(--surface-2);
    --bs-table-hover-color: var(--ink);
    --bs-table-border-color: var(--border);
    color: var(--ink);
    margin-bottom: 0;
    font-size: 0.8125rem;
}

.table > :not(caption) > * > * {
    padding: 0.625rem 0.875rem;
    border-bottom-color: var(--border);
}

.table thead th {
    background: var(--surface-2);
    color: var(--ink-soft);
    font-weight: 500;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid var(--border);
    padding: 0.625rem 0.875rem;
    white-space: nowrap;
}

.table tbody tr:last-child td { border-bottom: 0; }

.table-hover > tbody > tr:hover > * {
    background: var(--surface-2);
    color: var(--ink);
}

.table-nowrap td, .table-nowrap th { white-space: nowrap; }
```

### Compact / wrapped tables

```css
.table-compact { --bs-table-cell-padding: 0.35rem 0.625rem; font-size: 0.75rem; }
.table-compact thead th { font-size: 0.6875rem; background: var(--surface-2); }

.table-wrapper {
    overflow: auto;
    max-height: 66vh;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    background: var(--surface);
}
```

---

## 9. Badges & Status Pills

```css
.badge {
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.01em;
    padding: 0.1875rem 0.5rem;
    border-radius: 999px;
    text-transform: none;
    line-height: 1.4;
}

.badge.bg-primary { background: var(--accent-soft) !important; color: var(--accent) !important; }
.badge.bg-success { background: var(--success-soft) !important; color: var(--success) !important; }
.badge.bg-warning { background: var(--warning-soft) !important; color: var(--warning) !important; }
.badge.bg-danger  { background: var(--danger-soft)  !important; color: var(--danger)  !important; }
.badge.bg-info    { background: var(--info-soft)    !important; color: var(--info)    !important; }
.badge.bg-secondary { background: var(--surface-2) !important; color: var(--ink-soft) !important; }
.badge.bg-light { background: var(--surface-2) !important; color: var(--ink-soft) !important; }
.badge.bg-dark  { background: var(--ink) !important; color: var(--bg) !important; }
.badge.bg-purple { background: var(--purple-soft) !important; color: var(--purple) !important; }

.ll-badge-internal { background: var(--surface-2) !important; color: var(--ink-soft) !important; border: 1px solid var(--border); }
.ll-badge-bank { background: var(--purple-soft) !important; color: var(--purple) !important; }

.status-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3125rem;
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 0.1875rem 0.5rem;
    border-radius: 999px;
    white-space: nowrap;
    line-height: 1.4;
}

.status-pill::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
}

.status-pill.success { background: var(--success-soft); color: var(--success); }
.status-pill.warning { background: var(--warning-soft); color: var(--warning); }
.status-pill.danger  { background: var(--danger-soft);  color: var(--danger); }
.status-pill.info    { background: var(--info-soft);    color: var(--info); }
.status-pill.muted   { background: var(--surface-2);    color: var(--ink-soft); }
.status-pill.primary { background: var(--accent-soft);  color: var(--accent); }
```

---

## 10. Alerts

```css
.alert {
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    font-size: 0.8125rem;
    padding: 0.75rem 1rem;
    background: var(--surface);
    color: var(--ink);
}

.alert-success { background: var(--success-soft); color: var(--success); border-color: transparent; }
.alert-danger  { background: var(--danger-soft);  color: var(--danger);  border-color: transparent; }
.alert-warning { background: var(--warning-soft); color: var(--warning); border-color: transparent; }
.alert-info    { background: var(--info-soft);    color: var(--info);    border-color: transparent; }

.alert-heading { color: inherit; font-weight: 600; }
```

---

## 11. Modals

```css
.modal-content {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    color: var(--ink);
}

.modal-header { border-bottom: 1px solid var(--border); padding: 1rem 1.25rem; }
.modal-title  { font-size: 0.9375rem; font-weight: 600; color: var(--ink); }
.modal-body   { padding: 1.25rem; font-size: 0.8125rem; }
.modal-footer { border-top: 1px solid var(--border); padding: 0.75rem 1.25rem; gap: 0.5rem; }

.modal-backdrop.show { opacity: 0.6; }
```

---

## 12. Dropdowns

```css
.dropdown-menu {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    padding: 0.375rem;
    font-size: 0.8125rem;
}

.dropdown-item {
    border-radius: var(--radius);
    padding: 0.4375rem 0.625rem;
    color: var(--ink);
    font-weight: 400;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: background 0.12s ease, color 0.12s ease;
}

.dropdown-item i, .dropdown-item .icon {
    font-size: 0.875rem;
    color: var(--ink-muted);
    width: 1rem;
    text-align: center;
}

.dropdown-item:hover, .dropdown-item:focus {
    background: var(--surface-2);
    color: var(--ink);
}

.dropdown-item:hover i, .dropdown-item:focus i,
.dropdown-item:hover .icon, .dropdown-item:focus .icon {
    color: var(--ink);
}

.dropdown-item.active, .dropdown-item:active {
    background: var(--accent-soft);
    color: var(--accent);
}

.dropdown-item.active i, .dropdown-item.active .icon { color: var(--accent); }

.dropdown-divider { border-color: var(--border); margin: 0.375rem 0; }

.dropdown-header {
    color: var(--ink-muted);
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
    padding: 0.4375rem 0.625rem;
}
```

---

## 13. Tabs

```css
.nav-tabs {
    border-bottom: 1px solid var(--border);
    gap: 0;
}

.nav-tabs .nav-link {
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    color: var(--ink-soft);
    font-weight: 500;
    font-size: 0.8125rem;
    padding: 0.5rem 0.875rem;
    background: transparent;
}

.nav-tabs .nav-link:hover {
    color: var(--ink);
    border-bottom-color: var(--border-strong);
}

.nav-tabs .nav-link.active {
    color: var(--accent);
    background: transparent;
    border-bottom-color: var(--accent);
}
```

---

## 14. Progress

```css
.progress { background: var(--surface-2); border-radius: 999px; height: 6px; }
.progress-bar { background: var(--accent); }
.progress-bar.bg-success { background-color: var(--success) !important; }
.progress-bar.bg-warning { background-color: var(--warning) !important; }
.progress-bar.bg-danger  { background-color: var(--danger) !important; }
```

---

## 15. Utilities

```css
.divider { height: 1px; background: var(--border); margin: 1rem 0; border: 0; }

.text-muted  { color: var(--ink-muted) !important; }
.text-soft   { color: var(--ink-soft) !important; }
.text-primary { color: var(--accent) !important; }
.text-success { color: var(--success) !important; }
.text-warning { color: var(--warning) !important; }
.text-danger  { color: var(--danger)  !important; }
.text-info    { color: var(--info)    !important; }

.bg-surface    { background: var(--surface) !important; }
.bg-surface-2  { background: var(--surface-2) !important; }
.bg-app        { background: var(--bg) !important; }

.border { border-color: var(--border) !important; }
.border-top, .border-bottom, .border-start, .border-end { border-color: var(--border) !important; }

.shadow-sm { box-shadow: var(--shadow-sm) !important; }
.shadow    { box-shadow: var(--shadow)    !important; }
.shadow-md { box-shadow: var(--shadow-md) !important; }
.shadow-lg { box-shadow: var(--shadow-lg) !important; }

.rounded       { border-radius: var(--radius) !important; }
.rounded-1     { border-radius: var(--radius) !important; }
.rounded-2     { border-radius: var(--radius) !important; }
.rounded-3     { border-radius: var(--radius-lg) !important; }
.rounded-4     { border-radius: var(--radius-xl) !important; }
.rounded-circle { border-radius: 50% !important; }
```

---

## 16. Lead / Pipeline Cards

```css
.lead-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 1rem 1.125rem;
    box-shadow: var(--shadow);
    color: var(--ink);
    transition: border-color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease;
    height: 100%;
}

.lead-card:hover {
    border-color: var(--border-strong);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
}

.lead-card-title { font-size: 0.875rem; font-weight: 600; color: var(--ink); margin: 0; }
.lead-card-sub   { font-size: 0.75rem; color: var(--ink-soft); margin: 0; }
.lead-card-meta  { font-size: 0.75rem; color: var(--ink-muted); }
```

---

## 17. Empty State

```css
.empty-state {
    text-align: center;
    padding: 3rem 1.5rem;
    color: var(--ink-soft);
}

.empty-state i { font-size: 2rem; color: var(--ink-muted); margin-bottom: 0.5rem; display: block; }
.empty-state-title { font-size: 0.9375rem; font-weight: 600; color: var(--ink); margin: 0 0 0.25rem 0; }
.empty-state-text  { font-size: 0.8125rem; color: var(--ink-soft); margin: 0; }
```

---

## 18. Login Page

```css
.login-shell {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    background:
        radial-gradient(circle at 0% 0%, var(--accent-soft), transparent 50%),
        radial-gradient(circle at 100% 100%, var(--accent-soft), transparent 50%),
        var(--bg);
}

.login-card {
    width: 100%;
    max-width: 400px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    padding: 2rem 1.75rem;
}

.login-brand {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin-bottom: 1.5rem;
    justify-content: center;
}

.login-brand .brand-mark {
    width: 32px; height: 32px;
    border-radius: 8px;
    background: var(--accent);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
}

.login-brand .brand-text {
    font-weight: 700;
    font-size: 1.0625rem;
    color: var(--ink);
    letter-spacing: -0.01em;
}

.login-title { font-size: 1.125rem; font-weight: 600; color: var(--ink); text-align: center; margin: 0 0 0.25rem 0; }
.login-subtitle { font-size: 0.8125rem; color: var(--ink-soft); text-align: center; margin: 0 0 1.5rem 0; }

.auth-footer { text-align: center; margin-top: 1.25rem; font-size: 0.75rem; color: var(--ink-muted); }
.auth-footer a { color: var(--ink-soft); font-weight: 500; }
.auth-footer a:hover { color: var(--accent); }
```

---

## 19. DataTables Overrides

```css
.dataTables_wrapper .dataTables_length,
.dataTables_wrapper .dataTables_filter,
.dataTables_wrapper .dataTables_info,
.dataTables_wrapper .dataTables_paginate {
    color: var(--ink-soft);
    font-size: 0.75rem;
    padding-top: 0.75rem;
}

.dataTables_wrapper .dataTables_length select,
.dataTables_wrapper .dataTables_filter input {
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--ink);
    border-radius: var(--radius);
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    margin: 0 0.3125rem;
}

.dataTables_wrapper .dataTables_filter input:focus,
.dataTables_wrapper .dataTables_length select:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
}

.dataTables_wrapper .dataTables_paginate .paginate_button {
    border: 1px solid var(--border) !important;
    background: var(--surface) !important;
    color: var(--ink-soft) !important;
    border-radius: var(--radius) !important;
    padding: 0.25rem 0.625rem !important;
    margin: 0 0.125rem !important;
    font-size: 0.75rem !important;
}

.dataTables_wrapper .dataTables_paginate .paginate_button:hover {
    background: var(--surface-2) !important;
    color: var(--ink) !important;
    border-color: var(--border-strong) !important;
}

.dataTables_wrapper .dataTables_paginate .paginate_button.current,
.dataTables_wrapper .dataTables_paginate .paginate_button.current:hover {
    background: var(--accent) !important;
    color: #fff !important;
    border-color: var(--accent) !important;
}

.dataTables_wrapper .dataTables_paginate .paginate_button.disabled,
.dataTables_wrapper .dataTables_paginate .paginate_button.disabled:hover {
    background: var(--surface-2) !important;
    color: var(--ink-muted) !important;
    border-color: var(--border) !important;
    cursor: not-allowed;
    opacity: 0.6;
}

.dt-button-info,
.dt-button-collection {
    background: var(--surface) !important;
    border: 1px solid var(--border) !important;
    box-shadow: var(--shadow-lg) !important;
    color: var(--ink) !important;
}

.dt-button {
    background: var(--surface) !important;
    border: 1px solid var(--border) !important;
    color: var(--ink) !important;
    border-radius: var(--radius) !important;
    font-size: 0.75rem !important;
    padding: 0.3125rem 0.625rem !important;
}

.dt-button:hover {
    background: var(--surface-2) !important;
    border-color: var(--border-strong) !important;
    color: var(--ink) !important;
}
```

---

## 20. Misc Components

```css
/* Hero banner */
.hero {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    padding: 1.75rem 2rem;
    margin-bottom: 1.5rem;
    box-shadow: var(--shadow);
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
}

.hero-title { font-size: 1.5rem; font-weight: 700; color: var(--ink); margin: 0 0 0.25rem 0; letter-spacing: -0.02em; }
.hero-subtitle { font-size: 0.875rem; color: var(--ink-soft); margin: 0; }
.hero-actions { margin-left: auto; display: flex; gap: 0.5rem; flex-wrap: wrap; }
.hero-illust { width: 80px; height: 80px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: var(--ink-muted); font-size: 2.5rem; opacity: 0.6; }

@media (max-width: 575.98px) {
    .hero { padding: 1.25rem; }
    .hero-illust { display: none; }
    .hero-actions { width: 100%; margin-left: 0; }
}

/* Info row */
.info-row { display: flex; align-items: center; gap: 0.875rem; }
.info-row-icon {
    width: 40px; height: 40px;
    border-radius: var(--radius);
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 1rem;
    flex-shrink: 0;
    color: #fff;
}
.info-row-label { font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-muted); margin-bottom: 0.0625rem; }
.info-row-value { font-size: 0.875rem; font-weight: 600; color: var(--ink); }

/* Row tints */
.row-tint-success td { background: var(--success-soft) !important; }
.row-tint-warning td { background: var(--warning-soft) !important; }
.row-tint-danger td  { background: var(--danger-soft)  !important; }
.row-tint-info td    { background: var(--info-soft)    !important; }
.row-tint-primary td { background: var(--accent-soft)  !important; }

/* Spinner */
.spinner-inline {
    display: inline-block;
    width: 16px; height: 16px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    vertical-align: middle;
    margin-right: 0.375rem;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Animations */
.fade-in-up { animation: fadeInUp 0.3s ease both; }

@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
}

/* Scrollbar */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 5px; }
::-webkit-scrollbar-thumb:hover { background: var(--border-strong); }
```

---

## 21. Responsive Breakpoints

| Breakpoint | Width |
|------------|-------|
| xs | < 576px |
| sm | ≥ 576px |
| md | ≥ 768px |
| lg | ≥ 992px |
| xl | ≥ 1200px |
| xxl | ≥ 1400px |

Key responsive rules used in this project:
- Sidebar collapses to overlay below `992px`
- Topbar search and username hide below `576px`
- Content padding increases at `1400px`
- Hero illustration hides below `576px`

---

## 22. Page Pattern

```html
<!DOCTYPE html>
<html lang="en" data-bs-theme="light">
<head>
    <base href="/">
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Page Title</title>
    <link href="vendor/css/bootstrap.min.css" rel="stylesheet">
    <link href="vendor/css/bootstrap-icons.css" rel="stylesheet">
    <link href="assets/css/app-theme.css" rel="stylesheet">
    <script src="vendor/js/jquery.min.js"></script>
</head>
<body>
<div class="app-shell">
    <?php include 'php_scripts/sidebar.php'; ?>
    <div class="app-main">
        <?php include 'php_scripts/topbar.php'; ?>
        <main class="app-content">
            <!-- Page content here -->
        </main>
        <footer class="app-footer">
            <!-- Footer content -->
        </footer>
    </div>
</div>
<script src="vendor/js/bootstrap.bundle.min.js"></script>
<script src="assets/js/theme.js"></script>
<script src="assets/js/sidebar.js"></script>
</body>
</html>
```

---

## 23. Iconography

- **Library:** Bootstrap Icons (`bi bi-*`)
- **Sizes:** `0.875rem` (small), `0.9375rem` (default), `1rem` (large), `2.5rem` (hero)
- **Common icons used:**
  - `bi-grid-1x2` — Dashboard
  - `bi-person` — Profile
  - `bi-table` / `bi-database` — Database
  - `bi-people` — Users
  - `bi-diagram-3` — Teams
  - `bi-kanban` — Pipeline
  - `bi-bar-chart` — Reports
  - `bi-shield-lock` — Admin
  - `bi-activity` — Activity
  - `bi-gear` — Settings
  - `bi-box-arrow-right` — Logout

---

## 24. Copying to Another Project

1. Copy `assets/css/app-theme.css` and `assets/vendor/` (Bootstrap, Bootstrap Icons, jQuery)
2. Include the CSS/JS in your page `<head>` as shown in the page pattern above
3. Use the HTML structure: `app-shell` → `app-sidebar` + `app-main` → `topbar` + `app-content`
4. Apply component classes from sections 5-20
5. For dark mode, toggle `data-bs-theme="dark"` on `<html>` and persist in `localStorage`

---

*Extracted from CallNow CRM V5.00 — September 2026*
