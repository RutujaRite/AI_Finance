# MedFlow Layout & Architecture Patterns

This guide documents the layout architecture, real-time sync mechanisms, theme behavior, and responsive rules used throughout the MedFlow frontend.

---

## 1. Page Template Archetypes

### Archetype A: Entity Management Page (e.g. `Patients`, `Doctors`, `Wards`)
1. **Stats Header**: 4-column KPI cards (`StatsCards`) displaying Total, Active, New This Month, and Discharge/Activity Rates.
2. **Main Card Wrapper**: A single `Card` containing:
   - `CardHeader`: Title, descriptive subtitle, `GlobalSearch` input, and primary action `<AddButton>Add Patient</AddButton>`.
   - `FilterBar`: Category and Value selectors with a "Clear Filters" button when active.
   - `TableContainer`: Overflow-x container wrapping the `Table` with row click or view action buttons.
   - `CardFooter`: `<CustomPagination>` with current page count and Previous/Next buttons.
3. **Overlays**:
   - `<DetailsSheet>` floating from the right on row selection.
   - `<CreateUserModal>` for creating or editing records.
   - `<ConfirmationDialog>` for destructive actions.

### Archetype B: Workflow / Clinical Board (e.g. `LabResults`, `QueueManagement`, `Consultation`)
1. **Header & Mode Controls**: Title with live status ping (`Live Sync Active`), sound toggle, and TV / Fullscreen trigger button.
2. **Spotlight Selection Card**: Gradient card (`bg-gradient-to-r from-teal-50/70 via-white to-teal-50/30 dark:from-teal-950/30 dark:via-slate-900`) highlighting active patient ID, ward badge, and doctor.
3. **Workspace Panels (Split Grid)**:
   - Left column (`lg:col-span-8`): Diagnostic image viewer, tabbed clinical findings, or live queue calling board.
   - Right column (`lg:col-span-4`): AI analysis container, vitals log, or quick action dispatch.

---

## 2. Real-Time Socket.IO Synchronization

MedFlow uses a shared WebSocket client (`@/lib/socket`) for instantaneous hospital-wide state synchronization:

```typescript
useEffect(() => {
  if (!socket.connected) socket.connect();

  const handleUpdate = () => {
    void queryClient.invalidateQueries({ queryKey: ["target-query"] });
  };

  socket.on("queue_updated", handleUpdate);
  socket.on("user_created", handleUpdate);

  return () => {
    socket.off("queue_updated", handleUpdate);
    socket.off("user_created", handleUpdate);
  };
}, [queryClient]);
```

---

## 3. Light & Dark Theme System

Theme persistence is implemented via `localStorage` with a pre-render execution script in `root.tsx` to prevent theme flash:

```html
<script>
  (function() {
    try {
      var storageKey = "medflow-theme";
      var defaultTheme = "system";
      var theme = localStorage.getItem(storageKey) || defaultTheme;
      var supportDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
      var root = document.documentElement;
      root.classList.remove("light", "dark");
      if (theme === "dark" || (theme === "system" && supportDarkMode)) {
        root.classList.add("dark");
      } else {
        root.classList.add("light");
      }
    } catch (e) {}
  })();
</script>
```

When authoring Tailwind classes, always pair light and dark tokens explicitly:
- Canvas: `bg-[#F7FAFC] dark:bg-slate-950`
- Cards: `bg-white dark:bg-slate-900`
- Borders: `border-slate-200 dark:border-slate-800`
- Text: `text-[#19324D] dark:text-slate-100`
- Secondary text: `text-slate-500 dark:text-slate-400`
- Soft containers: `bg-slate-50/70 dark:bg-slate-900/60`

---

## 4. Responsive Rules Summary

| Screen Size | Breakpoint | Layout Adaptations |
| :--- | :--- | :--- |
| **Mobile** | `< 640px` | Single column; `SidebarProvider` collapses to Sheet drawer; Header hides username text; Modals are `w-[calc(100vw-32px)]`; Tables allow touch pan horizontal scroll. |
| **Tablet** | `640px - 1024px` | 2-column KPI cards; Search bar locks to fixed width (`w-72`); Right-side panel floats with `inset-y-3 right-3 rounded-2xl max-w-xl`. |
| **Desktop** | `>= 1024px` | 4-column KPI cards; Full sidebar with expanded groups; 12-column grid dashboards (`8 / 4` split); Large table views with full metadata columns. |
