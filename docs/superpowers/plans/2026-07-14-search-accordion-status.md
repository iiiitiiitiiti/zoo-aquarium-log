# 施設検索アコーディオン・営業状態フィルター Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 検索・絞り込みUIを閉じたアコーディオンにまとめ、営業状態でも施設を絞り込めるようにする。

**Architecture:** `filterFacilities` に営業状態の条件を追加し、`App` が検索・種別・都道府県・営業状態をANDで渡す。検索領域はネイティブ `details` の閉状態を初期値とし、CSSで既存のカードUIに合わせる。カードの営業状態ラベルは施設データの値から生成する。

**Tech Stack:** React, TypeScript, Vitest, Vite, CSS

## Global Constraints

- `src/data/facilities.json` の `open / suspended / closed` 定義を変更しない。
- 初期表示では検索領域を閉じ、閉じても選択条件を保持する。
- 既存の検索・種別・都道府県フィルターと営業状態はAND条件で適用する。
- 施設カードには実データに対応した「営業中」「休園中」「閉園済み」を表示する。

---

### Task 1: Failing tests for status filtering and accordion behavior

**Files:**
- Modify: `src/filterFacilities.test.ts`
- Modify: `src/App.test.tsx`

**Interfaces:**
- `filterFacilities(facilities, query, type, prefecture, status)` accepts a fifth status filter.
- The facility list renders a closed `details` element whose `summary` is `施設を探す`.

- [ ] **Step 1: Write the failing unit test**

Add a suspended fixture and assert that filtering with `suspended` returns only that facility while `open` excludes it.

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `npx vitest run src/filterFacilities.test.ts`
Expected: FAIL because the current function ignores the fifth argument.

- [ ] **Step 3: Write the failing UI test**

Render `App`, assert the searchbox is hidden while the details element is closed, open `施設を探す`, select `休園中`, and assert `大宮公園小動物園` remains while `札幌市円山動物園` does not. Assert the card status labels distinguish `営業中` and `休園中`.

- [ ] **Step 4: Run the UI test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL because the controls are always visible, no status filter exists, and cards are hardcoded to `営業中`.

### Task 2: Implement status filtering and semantic status labels

**Files:**
- Modify: `src/filterFacilities.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Preserve all existing four-argument callers by defaulting the new status argument to `all`.
- Use `Facility["status"] | "all"` for the new filter type.

- [ ] **Step 1: Add the status condition**

Update `filterFacilities` to compute `matchesStatus` and include it with the existing type, prefecture, and text conditions.

- [ ] **Step 2: Add the status state and filter tags**

Add `status` state, `statusFilters`, and `statusLabels` to `App`; pass `status` into `filterFacilities`; render status buttons inside the search panel; include status in the result-count condition.

- [ ] **Step 3: Render actual facility status**

Replace the hardcoded `営業中` badge with a class and label derived from `facility.status`: `open` → `営業中`, `suspended` → `休園中`, `closed` → `閉園済み`.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run src/filterFacilities.test.ts src/App.test.tsx`
Expected: PASS for the new status behavior and all existing assertions.

### Task 3: Make the controls a compact closed accordion

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- The summary remains keyboard accessible through native `details` behavior.
- The active filter count is derived from query, type, prefecture, and status and does not alter filter state when the details element closes.

- [ ] **Step 1: Wrap the controls**

Replace the always-visible section contents with a `details.controls`, a `summary.controls-summary`, and a `.controls-body`. Keep labels associated with their existing inputs.

- [ ] **Step 2: Add the summary state**

Show `検索・絞り込み` when no conditions are active; otherwise show the number of active conditions. Keep the details closed by default.

- [ ] **Step 3: Add compact styles**

Move the existing controls padding to the summary/body, remove the default summary marker, add a visible open/close affordance, and keep the existing mobile spacing and focus styles.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run src/App.test.tsx src/styles.test.ts`
Expected: PASS with no layout-related CSS assertion regressions.

### Task 4: Full verification and deployment

**Files:**
- Verify: `src/App.tsx`, `src/filterFacilities.ts`, `src/styles.css`, `src/App.test.tsx`, `src/filterFacilities.test.ts`

- [ ] **Step 1: Run the full verification suite**

Run: `npm run test:data`, `npm test -- --run`, `npm run lint`, `npm run build`, and `git diff --check`.
Expected: all tests and checks exit 0; the existing chunk-size warning may remain informational.

- [ ] **Step 2: Inspect the final diff**

Run: `git status --short` and `git diff --stat`; confirm only the requested accordion, status filter, tests, and documentation are changed.

- [ ] **Step 3: Commit and push**

Run: `git add src/App.tsx src/filterFacilities.ts src/styles.css src/App.test.tsx src/filterFacilities.test.ts docs/superpowers/specs/2026-07-14-search-accordion-status-design.md docs/superpowers/plans/2026-07-14-search-accordion-status.md; git commit -m "feat: 施設検索をアコーディオン化して営業状態で絞り込む"; git push origin main`.

- [ ] **Step 4: Confirm GitHub Pages deployment**

Check the latest `Deploy GitHub Pages` workflow for the pushed commit and verify the public site returns HTTP 200.
