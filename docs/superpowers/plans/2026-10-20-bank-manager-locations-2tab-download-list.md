# Bank Manager and Locations 2-Tab Layout & Download List Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
1. Rename the 'Bank Manager' module to **'Bank Manager and Locations'** across the application, moving the canonical route to `/admin/bank-manager-locations` while maintaining backwards-compatible redirection on `/admin/bank-managers`.
2. Implement the exact **2-tab segmented pill switcher layout** (matching the design in Company Search) in the Bank Manager and Locations module:
   - **Tab 1: 👔 Manager & Location Directory**: KPI metric cards, multi-field search, bank & city filters, server-side pagination, top toolbar with **"Download List"** action button and **`+ Add Manager`** creation modal, responsive table with row actions (View Details, Edit, **Download**, Delete).
   - **Tab 2: 📄 Upload & Spreadsheets**: Step 1 Bank Selection/Manual Entry gating, Step 2 Gated dropzone (locked until bank is selected/typed, accepts `.xlsx`, `.xls`, `.csv`), Step 3 Uploaded spreadsheets file history table with download & delete cascade.
3. Add a **"Download List"** action button in the top toolbar AND a **"Download"** action button in the row actions column of the **Company Search** page (`app/admin/company-search/page.tsx`).

---

## Architecture & File Map

1. **`app/api/bank-managers/route.ts`**:
   - Enhance `GET`: Add search query (`q`), bank filter (`bank`), city filter (`city`), pagination (`page`, `limit`), returning matching records, total count, available banks, and available cities.
   - Enhance `POST`: Add single manager record to `bank_managers`.
   - Add `PUT`: Update existing manager record by `id`.
   - Add `DELETE`: Remove manager record by `id`.
2. **`app/admin/bank-manager-locations/page.tsx`**:
   - Main page for Bank Manager and Locations with 2-tab segmented pill switcher (`.bp-tab-pill-group`).
   - Tab 1: Directory view with 4 KPI cards, search, filters, "Download List" button, `+ Add Manager`, row action buttons (View, Edit, Download row, Delete).
   - Tab 2: Bank-gated upload dropzone, 23 preset banks + manual bank entry, spreadsheet file table.
3. **`app/admin/bank-managers/page.tsx`**:
   - Re-export or redirect to `/admin/bank-manager-locations`.
4. **`components/admin/AdminHeader.tsx`**:
   - Update navigation link, mobile drawer item, and breadcrumb mappings to "Bank Manager and Locations" (`/admin/bank-manager-locations`).
5. **`app/admin/page.tsx`**:
   - Update module card title and href to "Bank Manager and Locations" (`/admin/bank-manager-locations`).
6. **`app/admin/company-search/page.tsx`**:
   - Add "Download List" button to the top action toolbar.
   - Add "Download" icon button to the table row actions column for each company record.

---

## Tasks

### Task 1: Backend API Enhancement for Bank Managers (`app/api/bank-managers/route.ts`)
- [ ] Add query parameters to `GET`: `q`, `bank`, `city`, `page`, `limit`.
- [ ] Add distinct bank and city extraction for frontend filter dropdowns.
- [ ] Add `PUT` handler to update manager records by `id`.
- [ ] Add `DELETE` handler to remove manager records by `id`.
- [ ] Test API endpoints via node script.

### Task 2: Implement "Bank Manager and Locations" Page (`app/admin/bank-manager-locations/page.tsx`)
- [ ] Replicate 2-tab pill switcher styling using `.bp-header-card`, `.bp-icon-badge`, `.bp-tab-pill-group`, `.bp-tab-pill`, `.bp-tab-pill-count`.
- [ ] Tab 1 (Manager & Location Directory):
  - 4 KPI summary cards (Total Managers, Partner Banks, Cities Covered, Ingested Files).
  - Search input (manager, branch, phone, email, city).
  - Bank & City filter dropdowns + Reset button.
  - Top action toolbar: **"Download List"** (Excel/CSV) + **`+ Add Manager`** button.
  - Manager table with columns: Manager Name, Bank, Branch / Code, City & State, Mobile & Email, Actions.
  - Action buttons per row: View Details modal, Edit modal, **Download** row record card, Delete confirmation modal.
  - Server-side pagination.
- [ ] Tab 2 (Upload & Spreadsheets):
  - Step 1: Bank selector dropdown with 23 partner banks + `+ Custom Bank / Manual Entry`.
  - Step 2: Gated upload dropzone (locked with warning until bank is chosen).
  - Step 3: Spreadsheets history table with download & delete actions.
- [ ] Set up backwards compatibility redirect in `app/admin/bank-managers/page.tsx`.

### Task 3: Navigation & Branding Updates
- [ ] Update `components/admin/AdminHeader.tsx`:
  - Navigation tab: "Bank Manager and Locations" (`/admin/bank-manager-locations`).
  - Mobile drawer link: "Bank Manager and Locations".
  - Breadcrumbs default label: "Bank Manager and Locations".
- [ ] Update `app/admin/page.tsx`:
  - Dashboard module card: "Bank Manager and Locations" linking to `/admin/bank-manager-locations`.

### Task 4: Download List Actions in Company Search (`app/admin/company-search/page.tsx`)
- [ ] Add prominent "Download List" action button in top toolbar next to "+ Add Company".
- [ ] Add "Download" icon button in the table row's "Actions" column to download an individual company record sheet/card.

### Task 5: Verification & Polish
- [ ] Run `npx tsc --noEmit` and ensure 0 TypeScript errors.
- [ ] Test all routes and download operations.
- [ ] Commit all changes to git.
