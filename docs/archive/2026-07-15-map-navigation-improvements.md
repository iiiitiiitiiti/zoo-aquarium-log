# Map and Detail Navigation Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 統一されたアコーディオン表示、地図から詳細への往復、詳細から対象施設へフォーカスした地図表示を実装する。

**Architecture:** 既存の `App.tsx` state 分岐を維持し、詳細画面の入口だけを `list` / `map` として保持する。`MapPanel` は `focusedFacilityId` を受け取り、既存の Leaflet 初期表示処理に対象施設フォーカスを追加する。詳細ページの地図導線は外部ページではなく、同じアプリ内の Leaflet + OpenStreetMap を再利用する。

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Leaflet 1.9.4, leaflet.markercluster 1.5.3, Vite

## Global Constraints

- 既存のルーターなし state 分岐を維持する。
- 地図データと表示サービスは既存どおり OpenStreetMap / Leaflet を使う。
- 手動追加施設を含む施設名は HTML 文字列へ埋め込まず `textContent` を使う。
- production code は、先に失敗するテストを確認してから変更する。
- 無関係な未追跡の `docs/research/step7-results/` ファイルはコミットに含めない。

---

### Task 1: アコーディオンのプラス記号を統一

**Files:**
- Modify: `src/styles.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `.controls-summary:after` と `.quick-actions-summary:after` の同一インジケータースタイル

- [ ] **Step 1: Write the failing test**

`src/styles.test.ts` の「collapsed quick actions」テストで、次を追加する。

```ts
expect(styles).toContain('.controls-summary:after,.quick-actions-summary:after{content:"＋";color:#2a7180;font:400 20px/1 "LINE Seed JP",sans-serif}');
expect(styles).toContain('.controls.is-open .controls-summary:after,.quick-actions.is-open .quick-actions-summary:after{content:"−"}');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/styles.test.ts`

Expected: FAIL because the current stylesheet declares the two `:after` rules separately and does not specify the same font shorthand.

- [ ] **Step 3: Write minimal implementation**

`src/styles.css` の個別の `:after` 宣言を、次の共通宣言に置き換える。

```css
.controls-summary:after,.quick-actions-summary:after{content:"＋";color:#2a7180;font:400 20px/1 "LINE Seed JP",sans-serif}.controls.is-open .controls-summary:after,.quick-actions.is-open .quick-actions-summary:after{content:"−"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/styles.test.ts`

Expected: PASS.

### Task 2: MapPanel の対象施設フォーカス

**Files:**
- Modify: `src/MapPanel.test.tsx`
- Modify: `src/MapPanel.tsx`

**Interfaces:**
- Consumes: `focusedFacilityId?: string`
- Produces: 指定施設が `shown` に含まれる場合の `setView([lat, lng], 12)` とポップアップ表示

- [ ] **Step 1: Write the failing test**

`src/MapPanel.test.tsx` に次のテストを追加する。

```tsx
it("focuses the requested facility and opens its popup", () => {
  render(<MapPanel shown={facilities} visitedIds={new Set()} marks={{}} focusedFacilityId="tokyo-zoo" onBack={vi.fn()} onSelectFacility={vi.fn()} />);

  expect(leafletMocks.map.setView).toHaveBeenCalledWith([35.716, 139.771], 12);
  expect(leafletMocks.marker.openPopup).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/MapPanel.test.tsx`

Expected: FAIL because `MapPanel` does not accept or use `focusedFacilityId`.

- [ ] **Step 3: Write minimal implementation**

`MapPanel` の props に `focusedFacilityId?: string` を追加し、マーカー更新 effect で対象施設を検索する。マーカーを追加した後は対象マーカーのポップアップを開く。初回表示範囲は対象施設を最優先し、対象がなければ既存の `shown.length` 分岐へ進む。

```tsx
const focusedFacility = focusedFacilityId
  ? shown.find((facility) => facility.id === focusedFacilityId)
  : undefined;
const requestedOpenFacilityId = focusedFacility?.id ?? openFacilityId;

if (requestedOpenFacilityId) {
  markers.find((marker) => marker.facilityId === requestedOpenFacilityId)?.openPopup();
}

if (focusedFacility) {
  map.setView([focusedFacility.lat, focusedFacility.lng], 12);
} else if (shown.length === 1) {
  map.setView([shown[0].lat, shown[0].lng], 12);
}
```

依存配列には `focusedFacilityId` を含める。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/MapPanel.test.tsx`

Expected: PASS.

### Task 3: 詳細画面の入口と地図導線を App / VisitPanel に配線

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/VisitPanel.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/VisitPanel.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- `VisitPanel` consumes `backLabel?: string` and `onShowOnMap: () => void`
- `App` keeps `detailOrigin: "list" | "map"` and `mapFocusFacilityId?: string`
- `App` passes `focusedFacilityId={mapFocusFacilityId}` to `MapPanel`

- [ ] **Step 1: Write the failing tests**

`src/App.test.tsx` に、地図ポップアップから詳細へ移った後に「← 地図に戻る」で地図へ戻るケースと、詳細から「地図で場所を見る」で地図を開くケースを追加する。`src/VisitPanel.test.tsx` には同ボタンが `onShowOnMap` を呼ぶケースを追加する。

```tsx
it("opens the map from a facility detail page", async () => {
  const user = userEvent.setup();
  render(<App visitStore={visitStore} />);
  await user.click(screen.getByRole("link", { name: /札幌市円山動物園/ }));
  await user.click(screen.getByRole("button", { name: "地図で場所を見る" }));
  expect(screen.getByRole("heading", { name: "施設マップ" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/App.test.tsx src/VisitPanel.test.tsx`

Expected: FAIL because the map mock has no popup detail route, `VisitPanel` has no location button, and the detail origin is not tracked.

- [ ] **Step 3: Write minimal implementation**

`App.tsx` に次の state と遷移を追加する。

```tsx
const [detailOrigin, setDetailOrigin] = useState<"list" | "map">("list");
const [mapFocusFacilityId, setMapFocusFacilityId] = useState<string>();

const openFacility = (facility: Facility, origin: "list" | "map" = "list") => {
  setFacilityEditorOpen(false);
  setMapOpen(false);
  setMapFocusFacilityId(undefined);
  setDetailOrigin(origin);
  setSelectedFacility(facility);
};
```

地図ポップアップからは `openFacility(facility, "map")` を呼び、一覧カードからは既定値を使う。詳細の戻る処理は `detailOrigin === "map"` なら詳細を閉じて地図を再表示し、それ以外は一覧へ戻す。詳細の地図ボタンは対象IDを `mapFocusFacilityId` に設定して地図を開く。

`VisitPanel.tsx` は戻るボタンのラベルを `backLabel` から表示し、公式サイトリンクの近くに次を追加する。

```tsx
<button type="button" className="facility-map-link" onClick={onShowOnMap}>
  地図で場所を見る
</button>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/App.test.tsx src/VisitPanel.test.tsx`

Expected: PASS.

### Task 4: 全体検証と公開

**Files:**
- Verify only: `src/App.tsx`, `src/App.test.tsx`, `src/MapPanel.tsx`, `src/MapPanel.test.tsx`, `src/VisitPanel.tsx`, `src/VisitPanel.test.tsx`, `src/styles.css`, `src/styles.test.ts`

- [ ] **Step 1: Run focused tests**

Run: `npm test -- --run src/styles.test.ts src/MapPanel.test.tsx src/App.test.tsx src/VisitPanel.test.tsx`

Expected: all focused tests pass.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run lint
npm test -- --run
npm run build
git diff --check
```

Expected: all commands exit with code 0. Existing Vite chunk-size warning is informational only if the build exits successfully.

- [ ] **Step 3: Inspect scope and commit**

Run `git diff --stat` and `git status --short`. Stage only the design/plan and requested implementation/test files; exclude unrelated untracked research files. Commit with:

```bash
git add docs/superpowers/specs/2026-07-15-map-navigation-design.md docs/superpowers/plans/2026-07-15-map-navigation-improvements.md src/App.tsx src/App.test.tsx src/MapPanel.tsx src/MapPanel.test.tsx src/VisitPanel.tsx src/VisitPanel.test.tsx src/styles.css src/styles.test.ts
git commit -m "feat: improve map and detail navigation"
```

- [ ] **Step 4: Push and verify the public site**

Run `git push origin main`, then request the README public URL with a cache-busting query containing the commit SHA. Verify HTTP 200 and confirm the deployed JavaScript contains the new map navigation labels or focus behavior.
