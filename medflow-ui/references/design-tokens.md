# MedFlow Design Tokens Reference

This document provides the raw design tokens, CSS variables, and utility classes directly extracted from `frontend/app/app.css` and the theme system.

---

## 1. CSS Variables (`app.css`)

### Light Mode (`:root`)
```css
:root {
  --background: #f7fafc;
  --foreground: #19324d;
  --card: #ffffff;
  --card-foreground: #19324d;
  --popover: #ffffff;
  --popover-foreground: #19324d;
  --primary: #0f9d8a;
  --primary-foreground: #ffffff;
  --secondary: #e8f5f3;
  --secondary-foreground: #087568;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --accent: #e8f1ff;
  --accent-foreground: #2456a6;
  --destructive: #dc5a67;
  --border: #e2e8f0;
  --input: #cbd5e1;
  --ring: #0f9d8a;
  --chart-1: oklch(0.6231 0.188 259.8145);
  --chart-2: oklch(0.5461 0.2152 262.8809);
  --chart-3: oklch(0.4882 0.2172 264.3763);
  --chart-4: oklch(0.4244 0.1809 265.6377);
  --chart-5: oklch(0.3791 0.1378 265.5222);
  --sidebar: #ffffff;
  --sidebar-foreground: #19324d;
  --sidebar-primary: #0f9d8a;
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: #e8f5f3;
  --sidebar-accent-foreground: #087568;
  --sidebar-border: #e2e8f0;
  --sidebar-ring: #0f9d8a;
  --radius: 0.75rem;
}
```

### Dark Mode (`.dark`)
```css
.dark {
  --background: oklch(0.2046 0 0);
  --foreground: oklch(0.9219 0 0);
  --card: oklch(0.2686 0 0);
  --card-foreground: oklch(0.9219 0 0);
  --popover: oklch(0.2686 0 0);
  --popover-foreground: oklch(0.9219 0 0);
  --primary: #18b39d;
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.2686 0 0);
  --secondary-foreground: oklch(0.9219 0 0);
  --muted: oklch(0.2393 0 0);
  --muted-foreground: oklch(0.7155 0 0);
  --accent: oklch(0.3791 0.1378 265.5222);
  --accent-foreground: oklch(0.8823 0.0571 254.1284);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --border: oklch(0.3715 0 0);
  --input: oklch(0.3715 0 0);
  --ring: #18b39d;
  --chart-1: oklch(0.7137 0.1434 254.624);
  --chart-2: oklch(0.6231 0.188 259.8145);
  --chart-3: oklch(0.5461 0.2152 262.8809);
  --chart-4: oklch(0.4882 0.2172 264.3763);
  --chart-5: oklch(0.4244 0.1809 265.5222);
  --sidebar: oklch(0.2046 0 0);
  --sidebar-foreground: oklch(0.9219 0 0);
  --sidebar-primary: oklch(0.6231 0.188 259.8145);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.3791 0.1378 265.5222);
  --sidebar-accent-foreground: oklch(0.8823 0.0571 254.1284);
  --sidebar-border: oklch(0.3715 0 0);
  --sidebar-ring: oklch(0.6231 0.188 259.8145);
  --radius: 0.625rem;
}
```

---

## 2. Tailwind v4 Inline Theme Bindings

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

---

## 3. Keyframe Animations

```css
@keyframes kpi-card-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.kpi-card-enter {
  animation: kpi-card-enter 650ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

@media (prefers-reduced-motion: reduce) {
  .kpi-card-enter {
    animation: none;
  }
}
```

---

## 4. Predefined Utility Classes
- `.card`: `@apply rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900;`
- `.dark-gradient`: `@apply bg-linear-to-b dark:from-[#1A1C20] dark:to-[#1b1f2c] from-[#f0f0f0] to-[#e0e0e0];`
- `.blue-gradient-dark`: `@apply bg-linear-to-b dark:from-[#0e0d1f] dark:to-[#1b1f2c] from-[#f0f0f0] to-[#e0e0e0];`
- `.border-gradient`: `@apply bg-linear-to-b dark:from-[#2f3035] dark:to-card from-[#f0f0f0] to-[#e0e0e0];`
