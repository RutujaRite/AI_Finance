# Bank Policy Dark Mode & 2-Tab Differentiation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
1. Resolve duplicate policy files in Bank Policy: Differentiate the two tabs:
   - **Tab 1: 📋 Policy Guidelines & Criteria**: Structured underwriting criteria directory (Min Salary, CIBIL score, Age limits, Min/Max Loan Amount, Tenure, ROI, FOIR, Status), with "Download List" action button, `+ Add Policy Guidelines` button, and row actions (View Guidelines, Edit Guidelines, Download single policy, Delete).
   - **Tab 2: 📄 Upload & Master Files**: 3-step upload layout: Step 1 Bank selector/custom typing -> Step 2 Bank-gated upload dropzone (locked until bank is selected/typed, accepts .pdf, .txt, .docx, .xlsx, .csv) -> Step 3 Master policy files history table with View, Download, and Delete actions.
2. Full Dark Mode compatibility:
   - Fix all hardcoded light colors (`#0f172a`, `#1e293b`, `#334155`, `#f1f5f9`, `#ffffff`) across header, pills, KPI cards, tables, footers, pagination, and modals in `components/PoliciesView.tsx`.
   - Add dark theme CSS rules for `.bp-header-card`, `.bp-tab-pill-group`, `.bp-tab-pill`, `.bp-footer`, `.bp-page-btn`.

---

## File Map

- Modify: `components/PoliciesView.tsx`
  - Add dark mode styling in `<style>` block and replace hardcoded colors.
  - Implement Tab 1 as structured "Policy Guidelines & Criteria" table with underwriting cutoffs.
  - Implement Tab 2 as "Upload & Master Files" with 3-step bank selection, gated dropzone, and file table.
  - Add "Download List" button and single policy download.
- Verify: `app/admin/bank-policy/page.tsx`
  - Ensure dark mode container and clean rendering.

---

## Tasks

### Task 1: Dark Mode CSS & Token Standardization in `components/PoliciesView.tsx`
- [ ] Add dark mode overrides for `.bp-header-card`, `.bp-icon-badge`, `.bp-tab-pill-group`, `.bp-tab-pill`, `.bp-footer`, `.bp-page-btn`, `.bp-page-indicator` in `<style>` block.
- [ ] Replace all hardcoded `#0f172a` text colors with `className="text-slate-900 dark:text-white"`.
- [ ] Replace hardcoded light card and modal surfaces with theme-aware classes.

### Task 2: Tab 1 "Policy Guidelines & Criteria" Implementation
- [ ] Rename Tab 1 pill to "Policy Guidelines & Criteria".
- [ ] Render 4 KPI summary cards with theme-aware styling.
- [ ] Add top toolbar with Search, Bank filter, Loan Type filter, Status filter, Reset, "Download List" button, and "+ Add Policy Guidelines" button.
- [ ] Render comprehensive Underwriting Guidelines table with columns: `#`, `Bank / Lender`, `Loan Type & Employment`, `Min Salary`, `CIBIL Cutoff`, `Age Limits`, `Loan Amount & Tenure`, `Status`, `Actions`.
- [ ] Add row actions: View Guidelines Details Modal, Edit Guidelines Modal, Download Policy Excel (`.xlsx`), and Delete Rule.

### Task 3: Tab 2 "Upload & Master Files" 3-Step Gated Upload Implementation
- [ ] Rename Tab 2 pill to "Upload & Master Files".
- [ ] Step 1: Bank selector dropdown with 23 partner banks + `+ Custom Bank / Manual Entry`.
- [ ] Step 2: Gated upload dropzone (locked until bank is selected or typed, accepts .pdf, .txt, .docx, .xlsx, .csv).
- [ ] Step 3: Master policy files history table with search, bank filter, View Document, Download File, and Delete actions.

### Task 4: Verification & Git Commit
- [ ] Run `npx tsc --noEmit` and confirm 0 errors.
- [ ] Verify light and dark mode appearance and HTTP status.
- [ ] Commit changes to git.
