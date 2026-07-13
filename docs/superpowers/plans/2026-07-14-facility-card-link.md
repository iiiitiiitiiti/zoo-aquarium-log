# 施設カードの詳細リンク化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 施設一覧の `.facility-card` 全体を施設詳細画面へのリンクにし、公式サイトへの導線を詳細画面へ集約する。

**Architecture:** 既存の `selectedFacility` state による画面切り替えを維持する。カードを `a` 要素として描画し、`href` に施設 ID を含めたうえでクリック時に既定のハッシュ遷移を抑止し、既存の詳細画面を表示する。公式サイトリンクは `VisitPanel` に残す。

**Tech Stack:** React 19、TypeScript、Vitest、Testing Library、CSS

## Global Constraints

- ルーターや新しい依存関係を追加しない。
- カード内に別のボタン・リンクを置かず、インタラクティブ要素を入れ子にしない。
- 既存の検索・絞り込み・訪問記録・詳細画面の戻る操作を維持する。

---

### Task 1: 施設カードを詳細リンクへ変更

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `Facility.id`、既存の `selectedFacility` state、`VisitPanel` の公式サイトリンク
- Produces: `href="#facility/<facility.id>"` を持つ施設カードリンク。クリック時は `setSelectedFacility(facility)` を呼び、詳細画面を表示する。

- [ ] **Step 1: 施設カードの失敗テストを書く**

`src/App.test.tsx` の公式サイトリンクテストを次のテストへ置き換え、カードリンクの `href`、クリック後の詳細画面、一覧と詳細での公式サイトリンクの位置を検証する。

```tsx
it("施設カードから詳細ページへ移動し、公式サイトは詳細ページに表示する", async () => {
  const user = userEvent.setup();
  render(<App visitStore={visitStore} />);

  const card = screen.getByRole("link", { name: /札幌市円山動物園/ });
  expect(card).toHaveAttribute("href", "#facility/hokkaido_maruyama_zoo");
  expect(screen.queryByRole("link", { name: /公式サイト/ })).not.toBeInTheDocument();

  await user.click(card);

  expect(screen.getByRole("heading", { name: "札幌市円山動物園" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /公式サイト/ })).toHaveAttribute("target", "_blank");
});
```

既存の訪問記録テストも、削除する「記録を見る」ボタンではなく、次のカードリンクをクリックする形に変更する。

```tsx
await user.click(screen.getByRole("link", { name: /札幌市円山動物園/ }));
```

- [ ] **Step 2: 失敗テストを実行する**

Run: `npm test -- --run src/App.test.tsx`

Expected: 新しいカードリンクテストが、カードが `a` 要素ではないため FAIL する。

- [ ] **Step 3: App のカードをリンクとして実装する**

`src/App.tsx` の `li.facility-card` を次の構造へ変更する。カード内の「記録を見る」ボタンと「公式サイトを見る」リンクは削除する。

```tsx
<li key={facility.id}>
  <a
    className="facility-card"
    href={`#facility/${facility.id}`}
    onClick={(event) => {
      event.preventDefault();
      setSelectedFacility(facility);
    }}
  >
    <div className="card-index">{String(index + 1).padStart(2, "0")}</div>
    <div className="card-body">
      <div className="badges">
        <span>{typeLabels[facility.type]}</span>
        <span className="open">営業中</span>
      </div>
      <h3>{facility.name}</h3>
      <p>{facility.pref} {facility.city}</p>
    </div>
  </a>
</li>
```

`src/styles.css` の `.facility-card` に `color:inherit;text-decoration:none;` を追加し、既存のカード見た目を維持したままリンクの既定装飾を抑える。不要になった `.card-actions`、`.card-body .card-actions a`、`.record-button` のルールを削除する。

- [ ] **Step 4: テストを実行して実装を検証する**

Run: `npm test -- --run src/App.test.tsx`

Expected: App テストが全件 PASS。

- [ ] **Step 5: 型チェックと差分を検証する**

Run: `npm run lint`

Expected: TypeScript が exit 0。

Run: `git diff --check`

Expected: 出力なし。

- [ ] **Step 6: 変更をコミットする**

```bash
git add src/App.tsx src/App.test.tsx src/styles.css docs/superpowers/specs/2026-07-14-facility-card-link-design.md docs/superpowers/plans/2026-07-14-facility-card-link.md
git commit -m "feat: 施設カードを詳細リンクに変更"
```
