# Detail Hero Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the visit-record action in place while grouping the map/site links and personal mark controls into two natural-width rows in the facility detail hero.

**Architecture:** Add one wrapper around the map and official-site controls in `src/VisitPanel.tsx`, then style that wrapper with a wrapping flex row. Keep the existing mark toggle group and all event handlers unchanged.

**Tech Stack:** React 19, TypeScript, CSS, Vite

## Global Constraints

- Do not move or restyle the existing visit-record add button.
- Keep all four controls at content width; do not force equal-width columns.
- Preserve existing actions, labels, colors, pressed states, and routing behavior.
- Do not touch unrelated untracked research files.

---

### Task 1: Group the detail-hero controls

**Files:**
- Modify: `src/VisitPanel.tsx:314-338`
- Modify: `src/styles.css:650-674,941-988`
- Test: no test file change; this is a small layout-only adjustment

**Interfaces:**
- Consumes: existing `onShowOnMap`, `facility.url`, `markStore`, and mark toggle handlers
- Produces: `.detail-hero-links` containing the map button and official-site link; existing `.mark-toggles` remains the personal-mark group

- [ ] **Step 1: Add the facility-link wrapper and specific site-link class**

In `src/VisitPanel.tsx`, render the controls in this order without changing their handlers:

```tsx
<div className="detail-hero-links" aria-label="施設情報">
  <button className="facility-map-link" type="button" onClick={onShowOnMap}>地図で場所を見る</button>
  <a className="facility-site-link" href={facility.url} target="_blank" rel="noreferrer">公式サイトを見る ↗</a>
</div>
{markStore && (
  <div className="mark-toggles" role="group" aria-label="施設のマーク">
    {/* existing mark buttons unchanged */}
  </div>
)}
```

Keep the custom-facility edit/delete group after the mark group and before the closing `header`.

- [ ] **Step 2: Style the facility-link row at natural width**

In `src/styles.css`, add the following layout rules and override the existing top margins inside the row:

```css
.detail-hero-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  margin-top: 18px;
}
.detail-hero-links .facility-map-link,
.detail-hero-links .facility-site-link {
  margin-top: 0;
}
```

Keep `width: max-content` on `.facility-map-link`, keep the existing site-link typography, and increase `.mark-toggles` separation only as needed to make the second row visually distinct. Remove the obsolete `.detail-hero .facility-actions + a` rule because the site link is now inside `.detail-hero-links`.

- [ ] **Step 3: Run static verification**

Run:

```bash
npm run lint
git diff --check
```

Expected: both commands complete successfully with no errors. Manually inspect the diff to confirm that the visit-record button and event handlers are unchanged.

- [ ] **Step 4: Commit the focused change**

```bash
git add src/VisitPanel.tsx src/styles.css docs/superpowers/specs/2026-07-15-detail-hero-actions-design.md docs/superpowers/plans/2026-07-15-detail-hero-actions.md
git commit -m "style: 詳細画面の操作リンクを整理"
```
