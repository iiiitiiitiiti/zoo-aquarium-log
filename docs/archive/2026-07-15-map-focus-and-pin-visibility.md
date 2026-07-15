# 地図ピン視認性・施設フォーカス改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 訪問済みピンを見やすくし、地図と詳細ページの往復で対象施設を中心表示できるようにする。

**Architecture:** `App` が地図表示モード（全施設／対象施設1件）とフォーカス施設IDを管理する。`MapPanel` は既存の `focusedFacilityId` を使って初期表示の中心・ズームとポップアップを制御し、`mapPins.ts` が訪問状態の配色を一元管理する。

**Tech Stack:** React、TypeScript、Leaflet、Leaflet.markercluster、Vitest、Testing Library、Vite、GitHub Pages。

## Global Constraints

- 新しい地図サービス・依存パッケージ・データスキーマは追加しない。
- 既存のフィルター、マークバッジ、詳細遷移、空状態の挙動を維持する。
- 本体コードを書く前に、対応する失敗テストを実行して赤を確認する。
- 検証後は `main` へコミット・pushし、GitHub Pagesの公開URLをHTTP確認する。

### Task 1: Pin appearance

**Files:**
- Modify: `src/mapPins.ts`
- Test: `src/mapPins.test.ts`

- [ ] **Step 1: Write the failing test**

訪問済みの `pinAppearance` が明るい緑の本体色と濃い緑の縁取りを返し、凡例にも同じ2色が反映されるテストを追加する。

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run src/mapPins.test.ts`

Expected: 既存の `#2f6b50` と期待する新色が一致せず失敗する。

- [ ] **Step 3: Implement the minimal color change**

`VISITED_COLOR` を `#35b978`、訪問済み用の縁取り定数を `#0f6b46` とし、訪問済みの `borderColor` と凡例の `borderColor` に使用する。未訪問色とバッジ色は変更しない。

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- --run src/mapPins.test.ts`

Expected: 対象テストが全てPASSする。

### Task 2: Map focus and one-facility mode

**Files:**
- Modify: `src/App.tsx`
- Inspect: `src/MapPanel.tsx`（既存の focusedFacilityId ロジックを維持）
- Test: `src/App.test.tsx`
- Test: `src/MapPanel.test.tsx`

**Interfaces:**
- `App` passes `shown` as either the filtered all-facility list or a one-facility list when `mapDisplayMode` is `facility`.
- `MapPanel` continues to consume optional `focusedFacilityId` and opens the matching marker after adding layers.

- [ ] **Step 1: Write failing tests for both navigation cases**

Add App tests that:

1. Select the map from the list, select a facility in the mocked map, return from detail, and assert `data-testid="map-focus"` contains that facility ID while the map count remains the full list count.
2. Open a facility detail from the list, click `地図で場所を見る`, and assert the mocked map receives one facility and that facility ID as focus.

Add a MapPanel test that keeps the existing focused facility assertion and confirms it opens the requested marker after the map layers are rebuilt.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --run src/App.test.tsx src/MapPanel.test.tsx`

Expected: the App navigation assertions fail because returning from map clears focus and detail-to-map currently passes all facilities.

- [ ] **Step 3: Implement minimal state transitions**

In `App`:

```ts
type MapDisplayMode = "all" | "facility";
const [mapDisplayMode, setMapDisplayMode] = useState<MapDisplayMode>("all");
```

When opening a facility, retain `facility.id` as `mapFocusFacilityId` only for `origin === "map"`, and reset the display mode to `all`. For `onShowOnMap`, set `mapDisplayMode` to `facility`, retain the selected ID, and open the map. Derive `mapShown` by filtering `shown` to the focus ID only in `facility` mode. Clear both mode and focus when leaving the map to the list.

In `MapPanel`, preserve the existing initial `setView` and popup behavior. Do not fit all bounds after a valid focus facility has been found.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- --run src/App.test.tsx src/MapPanel.test.tsx`

Expected: both navigation cases and all MapPanel tests PASS.

### Task 3: Full verification and release

**Files:**
- Modify: `src/mapPins.test.ts`, `src/App.test.tsx`, `src/MapPanel.test.tsx` as required by the focused test cycles.

- [ ] **Step 1: Run all tests**

Run: `npm test -- --run`

Expected: Vitest exits 0 with 0 failed tests.

- [ ] **Step 2: Run lint, build, and whitespace checks**

Run: `npm run lint`

Expected: TypeScript exits 0.

Run: `npm run build`

Expected: Vite exits 0; any existing chunk-size warning is recorded but does not block release.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 3: Inspect scope and commit**

Run: `git status --short` and verify only the design/plan docs and requested implementation/test files are changed. Commit with:

```bash
git add docs/superpowers/specs/2026-07-15-map-focus-and-pin-visibility-design.md docs/superpowers/plans/2026-07-15-map-focus-and-pin-visibility.md src/App.tsx src/MapPanel.tsx src/mapPins.ts src/App.test.tsx src/MapPanel.test.tsx src/mapPins.test.ts
git commit -m "feat: improve map pin visibility and facility focus"
```

- [ ] **Step 4: Push and verify GitHub Pages**

Run `git push origin main`, wait for the `Deploy GitHub Pages` workflow to succeed, then request the published site and confirm HTTP 200 plus the updated app shell. Report the canonical URL.
