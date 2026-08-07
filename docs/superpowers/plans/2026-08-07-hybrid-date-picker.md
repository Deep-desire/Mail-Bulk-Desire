# Hybrid Date Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single date picker with a Hybrid Date Picker (supporting Date Range, Multiple Discrete Dates, and Quick Presets) for filtering Delivery Logs.

**Architecture:** A reusable React `HybridDatePicker` popover component that manages range selection & multi-date array selection. The backend `/contacts/logs` API parses `startDate`, `endDate`, and comma-separated `dates` parameters and builds SQL OR queries over `sentAt` and `createdAt` timestamps.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide React Icons, Express.js, Prisma ORM.

---

## Global Constraints

- Must maintain dark aesthetic & responsive UI.
- API compatibility with existing `startDate` / `endDate` query params.

---

### Task 1: Update Backend `/contacts/logs` API Route

**Files:**
- Modify: `c:/mail-bulk-desire/backend/src/index.js:720-790`

- [ ] **Step 1: Modify backend query parser for discrete dates & date range**
  Update `GET /contacts/logs` in `backend/src/index.js` to process `req.query.dates` and `req.query.startDate`/`req.query.endDate`.
- [ ] **Step 2: Test backend route with curl / HTTP requests**
  Verify query responds with 200 OK for `?dates=2026-08-02,2026-08-05` and `?startDate=2026-08-01&endDate=2026-08-07`.

---

### Task 2: Update Frontend API Client

**Files:**
- Modify: `c:/mail-bulk-desire/frontend/src/api/upload.api.ts:76-84`

- [ ] **Step 1: Add `dates?: string` to `uploadApi.getDeliveryLogs` interface**

---

### Task 3: Build `HybridDatePicker` Component

**Files:**
- Create: `c:/mail-bulk-desire/frontend/src/components/HybridDatePicker.tsx`

- [ ] **Step 1: Create `HybridDatePicker.tsx` with mode tabs, calendar grid, quick presets, and date selection state**
- [ ] **Step 2: Add smooth transitions, click-outside listener, and dark mode styling**

---

### Task 4: Integrate `HybridDatePicker` in `DeliveryLogs.tsx`

**Files:**
- Modify: `c:/mail-bulk-desire/frontend/src/pages/DeliveryLogs.tsx`

- [ ] **Step 1: Integrate `HybridDatePicker` component in place of native date input**
- [ ] **Step 2: Render active date filter pills in table header with clear buttons**
- [ ] **Step 3: Connect to `fetchLogs` and verify filtering on Delivery Logs page**
