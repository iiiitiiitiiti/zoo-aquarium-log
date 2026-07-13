# Fixed Desktop Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the selected deep-water desktop background stationary while the app content scrolls.

**Architecture:** Add CSS background attachment to the existing `.site-stage` rule. Preserve the fixed curve pseudo-elements and the current mobile breakpoint without changing React or Firebase code.

**Tech Stack:** CSS, Vitest, Vite

## Global Constraints

- Preserve the current diagonal four-color background and transparent curve outlines.
- Preserve the 480px centered content width.
- Preserve the existing behavior at 480px and below.

---

### Task 1: Fix the deep-water background to the viewport

**Files:**
- Modify: `src/styles.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: Existing `.site-stage` CSS rule.
- Produces: A fixed background declaration covered by a regression test.

- [ ] **Step 1: Write the failing test**

```ts
it("keeps the deep-water background fixed while content scrolls", () => {
  expect(styles).toMatch(
    /\.site-stage\{[^}]*background-attachment:fixed/,
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/styles.test.ts`

Expected: FAIL because `.site-stage` does not contain `background-attachment:fixed`.

- [ ] **Step 3: Add the minimal CSS**

Add `background-attachment:fixed` to the existing `.site-stage` declaration after its `background` property.

- [ ] **Step 4: Verify tests and production build**

Run:

```powershell
npm test -- --run
npm run lint
npm run build
npm run test:data
git diff --check
```

Expected: All commands exit successfully.

- [ ] **Step 5: Verify in a browser**

At a desktop viewport, record the background image before and after scrolling and confirm it remains viewport-fixed. At a 390px viewport, confirm the shell width remains 390px with no horizontal scrolling.

- [ ] **Step 6: Commit**

```powershell
git add src/styles.css src/styles.test.ts
git commit -m "fix: PC背景をスクロール位置に固定"
```
