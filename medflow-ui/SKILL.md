---
name: medflow-ui
description: >-
  Comprehensive design system, UI component library, and styling guidelines for the MedFlow AI Hospital Management System.
  Use this skill whenever designing, creating, refactoring, or extending frontend components, pages, forms, tables, modals,
  drawers, status indicators, themes, or layouts in the MedFlow HMS frontend.
---

# MedFlow UI Design System & Component Skill

The **MedFlow UI** skill is the definitive source of truth for all frontend interfaces in the Incraax MedFlow AI Hospital Management System. All code in this system is built on **React 19**, **React Router 7**, **Tailwind CSS v4** (`@tailwindcss/vite`), **shadcn/ui (radix-nova style)**, **Radix UI**, **Lucide React**, **Sonner**, and **TanStack Query**.

Every design decision in MedFlow reflects a clinical, modern, trustworthy, high-density hospital environment: clean cool-slate backgrounds, signature teal/emerald primary accents, high contrast typography, rounded card containers, and instant real-time indicators.

---

## 1. Design Tokens & Foundations

### 1.1 Color Palette & Theme Tokens

MedFlow features dual light/dark themes powered by Tailwind CSS v4 variables with OKLCH fallbacks and inline theme bindings.

| Token | Light Value | Dark Value | Purpose & Usage |
| :--- | :--- | :--- | :--- |
| `--primary` | `#0f9d8a` (Signature Teal) | `#18b39d` (Bright Clinical Teal) | Main actions, active nav, primary buttons, branding |
| `--primary-foreground`| `#ffffff` | `oklch(1 0 0)` | Text on primary elements |
| `--secondary` | `#e8f5f3` (Soft Mint Tint) | `oklch(0.2686 0 0)` | Secondary buttons, role badges, soft highlighted rows |
| `--secondary-foreground` | `#087568` (Deep Mint) | `oklch(0.9219 0 0)` | Text on secondary elements |
| `--background` | `#f7fafc` (Cool Clinical Slate) | `oklch(0.2046 0 0)` / `slate-950` | Full page canvas background |
| `--foreground` | `#19324d` (Deep Slate Navy) | `oklch(0.9219 0 0)` / `slate-100` | Primary page text and headings |
| `--card` | `#ffffff` | `oklch(0.2686 0 0)` / `slate-900` | Card containers, modals, table wrappers |
| `--card-foreground` | `#19324d` | `oklch(0.9219 0 0)` | Text inside cards |
| `--muted` | `#f1f5f9` (Slate 100) | `oklch(0.2393 0 0)` | Muted panels, table hover backgrounds, disabled states |
| `--muted-foreground` | `#64748b` (Slate 500) | `oklch(0.7155 0 0)` | Subtitles, helper text, empty states, secondary labels |
| `--accent` | `#e8f1ff` (Soft Blue Tint) | `oklch(0.3791 0.1378 265.5222)` | Accent selections, special highlights |
| `--accent-foreground` | `#2456a6` (Deep Cobalt) | `oklch(0.8823 0.0571 254.1284)` | Text on accent elements |
| `--destructive` | `#dc5a67` (Coral Red) | `oklch(0.6368 0.2078 25.3313)` | Deletions, bans, emergency errors, cancellations |
| `--border` | `#e2e8f0` (Slate 200) | `oklch(0.3715 0 0)` / `slate-800` | Borders for cards, dividers, tables |
| `--input` | `#cbd5e1` (Slate 300) | `oklch(0.3715 0 0)` / `slate-700` | Input borders and select outlines |
| `--ring` | `#0f9d8a` | `#18b39d` | Focus ring color for accessibility |

#### Sidebar Tokens
- `--sidebar`: `#ffffff` (light) / `oklch(0.2046 0 0)` (dark)
- `--sidebar-foreground`: `#19324d` (light) / `oklch(0.9219 0 0)` (dark)
- `--sidebar-primary`: `#0f9d8a` (light) / `oklch(0.6231 0.188 259.8145)` (dark)
- `--sidebar-accent`: `#e8f5f3` (light) / `oklch(0.3791 0.1378 265.5222)` (dark)
- `--sidebar-border`: `#e2e8f0` (light) / `oklch(0.3715 0 0)` (dark)

#### Custom Gradient Utilities
```css
@utility dark-gradient {
  @apply bg-linear-to-b dark:from-[#1A1C20] dark:to-[#1b1f2c] from-[#f0f0f0] to-[#e0e0e0];
}

@utility blue-gradient-dark {
  @apply bg-linear-to-b dark:from-[#0e0d1f] dark:to-[#1b1f2c] from-[#f0f0f0] to-[#e0e0e0];
}

@utility border-gradient {
  @apply bg-linear-to-b dark:from-[#2f3035] dark:to-card from-[#f0f0f0] to-[#e0e0e0];
}
```

### 1.2 Typography Hierarchy

- **Font Family**: Primary sans is `"Inter", ui-sans-serif, system-ui, sans-serif` paired with `@fontsource-variable/geist` for numerical precision and headers. Monospace is `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`.
- **Page Headings**: `text-2xl sm:text-3xl font-extrabold tracking-tight text-[#19324D] dark:text-slate-100` (or gradient `bg-gradient-to-r from-primary via-indigo-600 to-sky-600 bg-clip-text text-transparent`).
- **Card / Modal Titles**: `text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight`.
- **Eyebrow / Section Labels**: `text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400`.
- **Body & Table Text**: `text-sm text-slate-700 dark:text-slate-200`.
- **Subtitles & Captions**: `text-xs sm:text-sm text-muted-foreground` (`text-slate-500 dark:text-slate-400`).
- **Codes, IDs & Tokens**: `font-mono text-xs font-semibold text-muted-foreground` (e.g. `#{user._id.slice(-6)}`). Large token displays use `font-mono text-5xl sm:text-7xl lg:text-8xl font-black text-white`.

### 1.3 Border Radius Scale

- `--radius`: `0.75rem` (12px) in light mode, `0.625rem` (10px) in dark mode.
- `--radius-sm`: `calc(var(--radius) - 4px)` (8px)
- `--radius-md`: `calc(var(--radius) - 2px)` (10px)
- `--radius-lg`: `var(--radius)` (12px)
- `--radius-xl`: `calc(var(--radius) + 4px)` (16px)
- **Component Roundedness Conventions**:
  - Cards, Modals, Details Sheets, Inputs: `rounded-2xl` (16px)
  - Buttons, Search Bars, Table Containers: `rounded-lg` (8px) or `rounded-[10px]`
  - Metric Icon Boxes: `rounded-2xl` (16px)
  - Status Badges: `rounded-4xl` (full pill shape)
  - Avatars: `rounded-lg` (header & table items) or `rounded-full` (profile hero)

---

## 2. Status Color Matrices & Domain Badges

### 2.1 Patient Clinical Statuses
Defined in `@/components/users/statusBadge`:

| Status | Label | Classes | Icon |
| :--- | :--- | :--- | :--- |
| `admitted` | Admitted | `bg-orange-100 text-orange-700 border-orange-200` | `Home` |
| `in_treatment` | In Treatment | `bg-blue-100 text-blue-700 border-blue-200` | `Activity` |
| `observation` | Observation | `bg-yellow-100 text-yellow-700 border-yellow-200` | `Clock` |
| `discharged` | Discharged | `bg-green-100 text-green-700 border-green-200` | `CheckCircle2` |
| `follow_up` | Follow Up | `bg-purple-100 text-purple-700 border-purple-200` | `AlertCircle` |

### 2.2 Staff Availability Statuses
| Status | Label | Classes | Icon |
| :--- | :--- | :--- | :--- |
| `active` | Active | `bg-emerald-100 text-emerald-700 border-emerald-200` | `CheckCircle2` |
| `on_leave` | On Leave | `bg-slate-100 text-slate-700 border-slate-200` | `Clock` |
| `resigned` | Resigned | `bg-red-50 text-red-700 border-red-200` | `LogOut` |

### 2.3 Appointment & Queue Statuses
```typescript
const appointmentStatusStyles: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  confirmed: "bg-cyan-100 text-cyan-800",
  waiting: "bg-amber-100 text-amber-800 border-amber-200 animate-pulse",
  called: "bg-indigo-600 text-white font-bold",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
  "in-progress": "bg-emerald-100 text-emerald-800",
  "no-show": "bg-rose-100 text-rose-800",
  Rescheduled: "bg-violet-100 text-violet-800",
};
```

### 2.4 AI Wait-Time Prediction Styles
- `<= 5 min`: `bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300`
- `<= 15 min`: `bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300`
- `<= 30 min`: `bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300`
- `> 30 min`: `bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300`

---

## 3. Core Component Library Patterns

### 3.1 Buttons (`@/components/ui/button` & `@/components/global/AddButton`)

#### Signature Primary Add Button (`AddButton`)
```tsx
import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const AddButton = forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  ({ className, children, ...props }, ref) => (
    <Button
      ref={ref}
      className={cn(
        "h-10 px-4 sm:px-5 rounded-lg text-sm font-semibold whitespace-nowrap text-white shadow-sm shadow-[#0f9d8a]/20",
        "bg-[#0f9d8a] hover:bg-[#0c8272] active:bg-[#0b7466] dark:bg-[#0f9d8a] dark:hover:bg-[#0c8272]",
        "transition-all duration-200 hover:-translate-y-px active:translate-y-0",
        "inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer",
        className
      )}
      {...props}
    >
      <Plus className="h-4 w-4 shrink-0" />
      {children}
    </Button>
  )
);
```

#### Button Variants & Sizes
- `default`: `bg-primary text-primary-foreground hover:bg-primary/80 hover:-translate-y-px`
- `outline`: `border-border bg-background hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30`
- `secondary`: `bg-secondary text-secondary-foreground hover:bg-secondary/80`
- `ghost`: `hover:bg-muted hover:text-foreground dark:hover:bg-muted/50`
- `destructive`: `bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/20`
- Micro-interactions: All buttons include `hover:-translate-y-px duration-200 active:scale-[0.98]`.

---

### 3.2 KPI Metrics & Stats Cards (`@/components/global/StatsCards`)

```tsx
<div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
  <Card className="kpi-card-enter relative border-none shadow-sm rounded-lg card transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:scale-[1.015] hover:shadow-lg hover:shadow-slate-900/10 dark:hover:shadow-black/30">
    {/* Watermark Illustration */}
    <Icon
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-3 -right-3 z-0 h-28 w-28 stroke-[1.15] opacity-[0.09] dark:opacity-[0.12] text-teal-600"
    />
    <CardContent className="relative z-10 p-4 sm:p-6">
      <div className="flex justify-between items-start mb-4">
        {/* Tinted Icon Box */}
        <div className="p-3 rounded-2xl bg-teal-100 dark:bg-teal-900/30">
          <Activity className="w-6 h-6 text-teal-600 dark:text-teal-400" />
        </div>
        {/* Trend Pill */}
        <div className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">
          +12.4%
        </div>
      </div>
      <div className="space-y-1">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
          1,482
        </span>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Active Treatments
        </p>
      </div>
    </CardContent>
  </Card>
</div>
```

---

### 3.3 Data Tables (`@/components/ui/table` & `@/components/users/UserManagement`)

Tables always feature responsive horizontal scroll, uppercase muted headers, sticky columns if needed, and hover row highlights:

```tsx
<div className="rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden">
  <div className="relative w-full overflow-x-auto touch-pan-x">
    <Table className="w-full min-w-full caption-bottom text-sm text-slate-700 dark:text-slate-200">
      <TableHeader>
        <TableRow className="border-b">
          <TableHead className="h-10 sm:h-11 bg-slate-50 px-3 sm:px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            Patient Name
          </TableHead>
          <TableHead className="h-10 sm:h-11 bg-slate-50 px-3 sm:px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            Contact
          </TableHead>
          <TableHead className="h-10 sm:h-11 bg-slate-50 px-3 sm:px-4 text-center align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            Status
          </TableHead>
          <TableHead className="h-10 sm:h-11 bg-slate-50 px-3 sm:px-4 text-right align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="border-b transition-colors hover:bg-muted/50">
          <TableCell className="px-3 py-2.5 sm:px-4 sm:py-3.5 align-middle font-medium">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 rounded-lg shrink-0">
                <AvatarImage src="/avatar.jpg" />
                <AvatarFallback className="rounded-lg text-primary text-xs font-semibold">JD</AvatarFallback>
              </Avatar>
              <span>John Doe</span>
            </div>
          </TableCell>
          <TableCell className="px-3 py-2.5 sm:px-4 sm:py-3.5 align-middle text-muted-foreground font-mono text-xs">
            +91 98765 43210
          </TableCell>
          <TableCell className="px-3 py-2.5 sm:px-4 sm:py-3.5 align-middle text-center">
            <Badge variant="outline" className="gap-1.5 bg-orange-100 text-orange-700 border-orange-200">
              <Home className="size-3" /> Admitted
            </Badge>
          </TableCell>
          <TableCell className="px-3 py-2.5 sm:px-4 sm:py-3.5 align-middle text-right">
            <Button variant="outline" size="sm" className="h-8 px-3">View</Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
  {/* Custom Pagination */}
  <CustomPagination currentPage={1} totalPages={10} loading={false} setPage={setPage} />
</div>
```

---

### 3.4 Right-Side Floating Panels / Details Sheets (`@/components/users/DetailsSheet`)

MedFlow uses a distinctive desktop floating drawer design with rounded borders and background spacing:

```tsx
<Sheet open={isOpen} onOpenChange={onClose}>
  <SheetContent
    side="right"
    className="w-full sm:max-w-xl md:max-w-2xl h-full sm:h-[calc(100dvh-1.5rem)] inset-y-0 right-0 sm:inset-y-3 sm:right-3 sm:rounded-2xl border-l sm:border shadow-2xl p-0 overflow-hidden bg-card text-card-foreground flex flex-col gap-0 outline-none"
  >
    {/* Header with Hero Avatar and Badges */}
    <div className="relative p-5 sm:p-6 pr-14 sm:pr-16 bg-slate-50/80 dark:bg-slate-900/80 border-b border-border shrink-0 backdrop-blur-xs">
      <SheetHeader className="flex flex-row items-center gap-4 space-y-0 text-left p-0">
        <Avatar className="h-16 w-16 shrink-0 border-2 border-background shadow-md">
          <AvatarImage src={user.image} />
          <AvatarFallback className="text-lg font-bold bg-[#0f9d8a]/10 text-[#0f9d8a]">
            {user.initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <SheetTitle className="text-lg sm:text-xl font-bold tracking-tight truncate">
            {user.name}
          </SheetTitle>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
            <Badge variant="secondary" className="capitalize text-xs font-semibold px-2 py-0.5">
              {user.role}
            </Badge>
            <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">
              Active
            </Badge>
          </div>
        </div>
      </SheetHeader>
    </div>

    {/* Scrollable Body with Tabs */}
    <ScrollArea className="flex-1 min-h-0 w-full overflow-hidden">
      <div className="p-5 sm:p-6">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="profile">Profile Details</TabsTrigger>
            <TabsTrigger value="clinical">Clinical History</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            {/* Field groups */}
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  </SheetContent>
</Sheet>
```

---

### 3.5 Modals & Creation Dialogs (`@/components/users/CreateUserModal`)

Modals use structured 3-part layout: pinned header with icon badge, scrollable form body, and pinned footer.

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="!w-[880px] !max-w-[calc(100vw-32px)] max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-card shadow-2xl">
    {/* Pinned Header */}
    <DialogHeader className="px-4 py-4 sm:px-6 sm:py-5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shrink-0">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-[#0f9d8a]/15 text-[#0f9d8a] flex items-center justify-center shrink-0">
          <Stethoscope className="w-5 h-5" />
        </div>
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Add New Doctor
            </DialogTitle>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#0f9d8a]/10 text-[#087568] dark:text-[#18b39d] border border-[#0f9d8a]/20">
              Doctor
            </span>
          </div>
          <DialogDescription className="text-xs text-muted-foreground truncate">
            Create and configure a verified doctor account in Incraax MedFlow AI.
          </DialogDescription>
        </div>
      </div>
    </DialogHeader>

    {/* Scrollable Form Body */}
    <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Custom Inputs */}
      </div>
    </div>

    {/* Pinned Footer */}
    <DialogFooter className="m-0 mx-0 mb-0 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0 rounded-none rounded-b-2xl">
      <Button variant="outline" type="button" onClick={() => setOpen(false)} className="h-10 px-5 rounded-lg">
        Cancel
      </Button>
      <Button type="submit" className="h-10 px-6 font-semibold rounded-lg bg-[#0f9d8a] hover:bg-[#0c8272] text-white shadow-md shadow-[#0f9d8a]/20">
        Create Doctor
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### 3.6 Form Elements & Inputs (`@/components/global/CustomInput`)

Custom inputs feature deep rounded corners (`rounded-2xl`), left icons, clear buttons, and invalid validation rings:

```tsx
<Field data-invalid={fieldState.invalid} className="space-y-1.5">
  <FieldLabel className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
    Email Address
  </FieldLabel>
  <div className="relative group">
    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors pointer-events-none z-10 w-4 h-4" />
    <Input
      className={cn(
        "w-full rounded-2xl border border-slate-300 bg-white py-6 pl-12 pr-4 text-sm transition-all outline-none shadow-sm text-slate-900",
        "focus-visible:ring-1 focus-visible:ring-[#0f9d8a] focus-visible:border-[#0f9d8a]",
        "dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
        fieldState.invalid && "border-red-300 focus:border-red-500 focus:ring-red-200 dark:border-red-900"
      )}
    />
  </div>
  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
</Field>
```

---

### 3.7 AI & Clinical Insight Cards (`@/components/users/tabs/Radiology`)

Specialized clinical boxes highlight AI diagnostic output and clinician notes:

```tsx
{/* AI Analysis Box */}
<div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-2">
  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] uppercase tracking-wider">
    <BrainCircuit className="h-4 w-4" /> AI Diagnostic Analysis
  </div>
  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
    Clear lung fields bilaterally. Cardiac silhouette within normal limits. No acute focal consolidation, pneumothorax, or large pleural effusion.
  </p>
</div>

{/* Doctor's Clinical Notes Box */}
<div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-xl space-y-2">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-[11px] uppercase tracking-wider">
      <Stethoscope className="h-4 w-4" /> Doctor's Impressions
    </div>
  </div>
  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
    Patient responds well to antibiotic cycle. Follow-up scheduled in 10 days.
  </p>
</div>
```

---

### 3.8 Real-Time Socket Indicators & Pulse Badges

For live queue syncing and room activity:

```tsx
<Badge
  variant="outline"
  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 shadow-xs"
>
  <span className="relative flex h-2 w-2">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
  </span>
  Live Sync Active
</Badge>
```

---

## 4. Layout Architecture & Responsive Breakpoints

### 4.1 Master Shell Hierarchy
```text
Root (<html lang="en">)
├── <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
│   ├── <TooltipProvider>
│   └── <ToastProvider /> (Sonner)
└── Protected Layout
    └── <SidebarProvider>
        ├── <AppSidebar variant="inset" collapsible="icon" />
        └── <SidebarInset className="bg-[#F7FAFC] dark:bg-slate-950 min-w-0 overflow-x-hidden">
            ├── <Header className="h-16 sm:h-[72px] bg-white/95 backdrop-blur dark:bg-slate-950/95" />
            └── <main className="my-4 sm:my-6 px-3 sm:px-6 lg:px-8 min-w-0 max-w-full">
                └── <Outlet />
```

### 4.2 Breakpoints & Responsive Rules
- **Mobile (`< 640px`)**:
  - Main padding is `px-3 my-4`.
  - AppSidebar collapses into a mobile slide-out Sheet via `SidebarTrigger`.
  - KPI cards stack to 1 column (`grid-cols-1`).
  - Search inputs stretch full width (`w-full`).
  - Modal and Sheet widths span 100% viewport (`w-full !max-w-[calc(100vw-32px)]`).
  - Dialog footers reverse actions to stack cancel below primary (`flex-col-reverse`).
  - Tables enable horizontal finger scrolling with `overflow-x-auto touch-pan-x`.
- **Tablet (`640px - 1024px`)**:
  - Main padding expands to `px-6 my-6`.
  - KPI cards display in 2 columns (`sm:grid-cols-2`).
  - Search input fixes to `sm:w-72 md:w-80`.
  - Sheet panels float with `sm:max-w-xl` and `sm:rounded-2xl sm:inset-y-3 sm:right-3`.
- **Desktop (`>= 1024px`)**:
  - Main padding expands to `lg:px-8`.
  - KPI cards display in 4 columns (`lg:grid-cols-4`).
  - Dashboard splits into `lg:col-span-8` (Charts/Queue) and `lg:col-span-4` (Activity Logs).
  - Sidebar expands with group titles ("Platform", "Administration") and user drawer.

---

## 5. Implementation Verification Checklist

When building or updating any page with this skill, verify:
1. **Color Conformance**: Primary buttons use `#0f9d8a` (`hover:bg-[#0c8272]`), background uses `#f7fafc` (dark: `slate-950`), cards use `#ffffff` (dark: `slate-900`).
2. **Typography**: Headings use `Inter` / `font-bold` or `font-extrabold text-[#19324D] dark:text-slate-100`.
3. **Card Consistency**: Containers have `rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm`.
4. **Interactive Micro-animations**: Buttons have `hover:-translate-y-px`, KPI cards have `hover:-translate-y-1 hover:scale-[1.015]`.
5. **Dark Mode Fidelity**: Explicit dark variants are present on borders (`dark:border-slate-800`), cards (`dark:bg-slate-900`), and text (`dark:text-slate-100`).
6. **No Placeholder Imagery**: Use Lucide icons, real badges, or generative SVG diagrams.
7. **Accessibility**: All interactive elements have descriptive `aria-label`s, `title`s, and role bindings.

---

## 6. References & Companion Guides
- [Design Tokens Reference](./references/design-tokens.md): Exhaustive CSS tokens, color palettes, and typography metrics.
- [Component Catalog](./references/components.md): Copy-paste component templates for quick UI generation.
- [Layout & Architecture Patterns](./references/patterns-and-rules.md): Page recipes, socket real-time patterns, and responsive layout rules.
