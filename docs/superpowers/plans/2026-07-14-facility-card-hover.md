# 施設カードのリンク表示強化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 施設カードの右端に矢印を表示し、ホバー時の変化で詳細ページへのリンクであることを明示する。

**Architecture:** 既存の `a.facility-card` に矢印用の `span.card-arrow` を追加し、CSS の `:hover` と `@media (prefers-reduced-motion: no-preference)` でカードと矢印の変化を定義する。詳細遷移の state 処理やルーターは変更しない。

**Tech Stack:** React 19、TypeScript、Vitest、Testing Library、CSS

## Global Constraints

- ルーターや新しい依存関係を追加しない。
- カード全体のリンク操作と既存のキーボードフォーカス表示を維持する。
- `prefers-reduced-motion: reduce` 環境ではホバーの移動アニメーションを発生させない。

---

### Task 1: 矢印表示とホバー状態を追加

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: 既存の `a.facility-card` と `facility.id`
- Produces: カード右端の `span.card-arrow`、ホバー時に浮き上がるカードと右へ移動する矢印

- [ ] **Step 1: 矢印表示の失敗テストを書く**

`src/App.test.tsx` のカードリンクテストに、カード内の矢印要素が表示されることを追加する。矢印は装飾要素として `aria-hidden` にするため、アクセシブル名ではなく要素の内容を確認する。

```tsx
const card = screen.getByRole("link", { name: /札幌市円山動物園/ });
expect(card.querySelector(".card-arrow")).toHaveTextContent("→");
```

- [ ] **Step 2: 失敗テストを実行する**

Run: `npm test -- --run src/App.test.tsx`

Expected: `.card-arrow` 要素が存在しないため、追加したアサーションが FAIL する。

- [ ] **Step 3: 矢印要素を追加する**

`src/App.tsx` の `a.facility-card` 内、`card-body` の後ろに次を追加する。

```tsx
<span className="card-arrow" aria-hidden="true">→</span>
```

- [ ] **Step 4: ホバー用 CSS を追加する**

`src/styles.css` の `.facility-card` に `align-items:center`、`transition`、`will-change` を追加し、次のルールを追加する。

```css
.facility-card:hover{border-color:#a8d8d7;box-shadow:0 7px 0 #c7dbd0;transform:translateY(-2px)}
.card-arrow{flex:0 0 auto;color:#2a7180;font-size:22px;line-height:1;transition:color .2s ease,transform .2s ease}
.facility-card:hover .card-arrow{color:#173f35;transform:translateX(4px)}
@media(prefers-reduced-motion:reduce){.facility-card,.card-arrow{transition:none}.facility-card:hover{transform:none}.facility-card:hover .card-arrow{transform:none}}
```

既存の `prefers-reduced-motion: no-preference` ブロックは変更せず、カードの初回表示アニメーションを維持する。

- [ ] **Step 5: 対象テストを実行して検証する**

Run: `npm test -- --run src/App.test.tsx`

Expected: App テストが全件 PASS。

- [ ] **Step 6: 全体検証を実行する**

Run: `npm test -- --run`

Expected: 全テスト PASS。

Run: `npm run lint`

Expected: TypeScript が exit 0。

Run: `npm run build`

Expected: Vite build が exit 0。

Run: `git diff --check`

Expected: 出力なし。

- [ ] **Step 7: 変更をコミットする**

```bash
git add src/App.tsx src/App.test.tsx src/styles.css docs/superpowers/specs/2026-07-14-facility-card-hover-design.md docs/superpowers/plans/2026-07-14-facility-card-hover.md
git commit -m "feat: 施設カードのリンク表示を強化"
```
