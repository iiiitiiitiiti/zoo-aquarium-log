# 施設カードのリンク表示強化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 施設カードの右端に矢印を表示し、ホバー時に背景色を変えて詳細ページへのリンクであることを明示する。

**Architecture:** 既存の `a.facility-card` にある矢印表示を維持し、CSS の `:hover` でカード背景色だけを変化させる。詳細遷移の state 処理やルーターは変更しない。

**Tech Stack:** React 19、TypeScript、Vitest、Testing Library、CSS

## Global Constraints

- ルーターや新しい依存関係を追加しない。
- カード全体のリンク操作と既存のキーボードフォーカス表示を維持する。
- `prefers-reduced-motion: reduce` 環境ではホバーの背景色トランジションを発生させない。

---

### Task 1: ホバー背景色を変更

**Files:**
- Modify: `src/styles.css`
- Test: `src/styles.test.ts`

**Interfaces:**
- Consumes: 既存の `.facility-card` と自然系配色
- Produces: ホバー時に背景色だけが `#eaf5ef` へ変わるカードスタイル

- [ ] **Step 1: 背景色ホバーの失敗テストを書く**

`src/styles.test.ts` に、カードの背景色トランジションとホバー色を検証するテストを追加する。

```tsx
it("changes facility card background on hover", () => {
  expect(styles).toMatch(/\.facility-card\{[^}]*transition:background-color \.2s ease/);
  expect(styles).toContain(".facility-card:hover{background:#eaf5ef}");
});
```

- [ ] **Step 2: 失敗テストを実行する**

Run: `npm test -- --run src/styles.test.ts`

Expected: 現在のホバー定義に背景色指定がないため FAIL する。

- [ ] **Step 3: 背景色ホバーを実装する**

`src/styles.css` のカードに背景色だけのトランジションとホバー色を追加し、位置・影・枠色・矢印の変化を削除する。

```css
.facility-card{transition:background-color .2s ease}
.facility-card:hover{background:#eaf5ef}
```

- [ ] **Step 4: テストを実行して検証する**

Run: `npm test -- --run src/styles.test.ts`

Expected: styles テストが全件 PASS。

- [ ] **Step 5: 全体検証を実行する**

Run: `npm test -- --run`

Expected: 全テスト PASS。

Run: `npm run lint`

Expected: TypeScript が exit 0。

Run: `npm run build`

Expected: Vite build が exit 0。

Run: `git diff --check`

Expected: 出力なし。

- [ ] **Step 6: 変更をコミットする**

```bash
git add src/styles.css src/styles.test.ts docs/superpowers/specs/2026-07-14-facility-card-hover-design.md docs/superpowers/plans/2026-07-14-facility-card-hover.md
git commit -m "style: カードホバーを背景色に変更"
```
