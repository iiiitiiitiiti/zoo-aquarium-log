# 初期公開版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** パイロット施設20件を検索・種別絞り込みできるスマホ特化WebアプリをGitHub Pagesへ公開する。

**Architecture:** 施設情報は静的JSONとして同梱し、純粋関数で検索・絞り込みを行う。Reactは表示と入力状態だけを担当し、ViteのGitHub Pages用base設定とActionsで静的成果物を公開する。

**Tech Stack:** Vite 7、React 19、TypeScript 5、Vitest、Testing Library、GitHub Actions / Pages

## Global Constraints

- アプリ本体は最大幅480pxの1カラムとし、PCでも中央にスマホ幅で表示する。
- 配色は forest `#173F35`、leaf `#2F6B50`、water `#2A7180`、sky `#DCEFF0`、paper `#F7F4E8`、ink `#18231F` を使う。
- Google Fonts の `LINE Seed JP`（400 / 700 / 800）を読み込み、全UIへ適用する。
- Viteの `base` は `/zoo-aquarium-log/` とする。
- 初期版ではFirebase、訪問記録、地図、統計、未保存状態のUIを実装しない。

---

### Task 1: パイロット施設マスタと検証器

**Files:**
- Create: `src/data/facilities.json`
- Modify: `scripts/validate-facilities.mjs`
- Modify: `tests/facilities.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `Facility[]`として読み込める20件のJSONと、`validateFacilities(facilities): string[]`

- [ ] **Step 1: 必須フィールド・列挙値・20件を要求する失敗テストを書く**

```js
test("pilot master contains 20 valid facilities", async () => {
  const json = await readFile(new URL("../src/data/facilities.json", import.meta.url), "utf8");
  const facilities = JSON.parse(json);
  assert.equal(facilities.length, 20);
  assert.deepEqual(validateFacilities(facilities), []);
});
```

- [ ] **Step 2: REDを確認する**

Run: `npm run test:data`
Expected: `ENOENT` または施設件数不足でFAIL

- [ ] **Step 3: 公式サイトで確認した20施設をJSONへ追加し、検証器へ必須文字列、`type`、`status` の検証を追加する**

```js
const allowedTypes = new Set(["zoo", "aquarium", "both", "other"]);
const allowedStatuses = new Set(["open", "closed", "suspended"]);
```

- [ ] **Step 4: GREENを確認する**

Run: `npm run test:data`
Expected: すべてPASS

- [ ] **Step 5: コミットする**

```bash
git add src/data/facilities.json scripts/validate-facilities.mjs tests/facilities.test.mjs package.json
git commit -m "feat: パイロット施設マスタを追加"
```

### Task 2: Vite / React基盤と検索ロジック

**Files:**
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `src/main.tsx`
- Create: `src/types.ts`
- Create: `src/filterFacilities.ts`
- Create: `src/filterFacilities.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1の施設JSON
- Produces: `filterFacilities(facilities: Facility[], query: string, type: FacilityType | "all"): Facility[]`

- [ ] **Step 1: 検索・かな・地域・種別・空結果の失敗テストを書く**

```ts
expect(filterFacilities(fixtures, "うえの", "all")).toHaveLength(1);
expect(filterFacilities(fixtures, "東京都", "all")).toHaveLength(1);
expect(filterFacilities(fixtures, "", "aquarium").every((item) => item.type === "aquarium")).toBe(true);
expect(filterFacilities(fixtures, "存在しない", "all")).toEqual([]);
```

- [ ] **Step 2: REDを確認する**

Run: `npm test -- --run`
Expected: `filterFacilities` が存在せずFAIL

- [ ] **Step 3: 正規化した部分一致と種別絞り込みを実装する**

```ts
const normalizedQuery = query.trim().toLocaleLowerCase("ja-JP");
return facilities.filter((facility) => {
  const matchesType = type === "all" || facility.type === type;
  const haystack = [facility.name, facility.kana, facility.pref, facility.city].join(" ").toLocaleLowerCase("ja-JP");
  return matchesType && haystack.includes(normalizedQuery);
});
```

- [ ] **Step 4: GREENと型チェックを確認する**

Run: `npm test -- --run`
Expected: PASS

Run: `npm run build`
Expected: `dist/` が生成される

- [ ] **Step 5: コミットする**

```bash
git add index.html vite.config.ts tsconfig*.json src package.json package-lock.json
git commit -m "feat: React基盤と施設検索を追加"
```

### Task 3: スマホ特化の施設一覧UI

**Files:**
- Create: `src/App.tsx`
- Create: `src/App.test.tsx`
- Create: `src/styles.css`

**Interfaces:**
- Consumes: `filterFacilities`、施設JSON
- Produces: 検索欄、種別ボタン、結果件数、施設カード、0件表示

- [ ] **Step 1: 初期件数、検索、種別切替、0件表示、公式リンクの失敗テストを書く**

```tsx
expect(screen.getByText("20施設を掲載")).toBeInTheDocument();
await user.type(screen.getByRole("searchbox"), "上野");
expect(screen.getByText("恩賜上野動物園")).toBeInTheDocument();
expect(screen.getByRole("link", { name: /公式サイト/ })).toHaveAttribute("target", "_blank");
```

- [ ] **Step 2: REDを確認する**

Run: `npm test -- --run src/App.test.tsx`
Expected: `App` が存在せずFAIL

- [ ] **Step 3: UIと最大幅480pxのスタイルを実装する**

```css
.app-shell {
  width: min(100%, 480px);
  min-height: 100dvh;
  margin-inline: auto;
  background: var(--paper);
}
```

- [ ] **Step 4: UIテストとビルドを確認する**

Run: `npm test -- --run`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: スマホ向け施設一覧UIを追加"
```

### Task 4: GitHub Pages公開設定

**Files:**
- Create: `.github/workflows/deploy-pages.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `npm run build` の `dist/`
- Produces: `main` push時にPagesへ公開するActions workflow

- [ ] **Step 1: workflow静的検査を追加する**

```js
assert.match(workflow, /actions\/deploy-pages@v4/);
assert.match(workflow, /npm run build/);
assert.match(viteConfig, /base:\s*["']\/zoo-aquarium-log\/["']/);
```

- [ ] **Step 2: REDを確認する**

Run: `node --test tests/pages-config.test.mjs`
Expected: workflowが存在せずFAIL

- [ ] **Step 3: Pages workflowを実装する**

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

`actions/configure-pages@v5`、`actions/upload-pages-artifact@v3`、`actions/deploy-pages@v4` を使い、Node 22で `npm ci`、テスト、ビルドを実行する。

- [ ] **Step 4: 全検証を実行する**

Run: `npm run test:data && npm test -- --run && npm run build && git diff --check`
Expected: 全コマンド成功

- [ ] **Step 5: コミットする**

```bash
git add .github/workflows/deploy-pages.yml tests/pages-config.test.mjs README.md
git commit -m "ci: GitHub Pagesデプロイを追加"
```

### Task 5: 公開と表示確認

**Files:**
- No file changes expected

**Interfaces:**
- Produces: `https://iiiitiiitiiti.github.io/zoo-aquarium-log/`

- [ ] **Step 1: featureブランチをpushしmainへマージする**

```bash
git push origin feature/initial-implementation
git checkout main
git pull origin main
git merge feature/initial-implementation
git push origin main
```

- [ ] **Step 2: Actions完了を確認する**

Run: `gh run list --workflow deploy-pages.yml --limit 1`
Expected: `completed success`

- [ ] **Step 3: 公開URLを確認する**

Run: `Invoke-WebRequest https://iiiitiiitiiti.github.io/zoo-aquarium-log/`
Expected: HTTP 200で、HTMLに `動物園・水族館ログ` が含まれる

- [ ] **Step 4: 元のfeatureブランチへ戻る**

```bash
git checkout feature/initial-implementation
```
