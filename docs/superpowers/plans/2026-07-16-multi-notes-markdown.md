# 施設メモ複数化とMarkdown表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 施設メモを複数件管理できるようにし、施設メモと訪問記録のメモ・感想を安全なMarkdown表示に対応させる。

**Architecture:** 既存の `facilityNotes` コレクションを維持し、新規メモを自動IDドキュメントとして保存する。旧形式の1施設1メモは購読時に施設IDを補完して後方互換を保つ。Markdown表示は共通レンダラーに集約し、HTML化後にサニタイズする。

**Tech Stack:** React 19, TypeScript, Firebase Firestore, marked, dompurify, Vitest, Testing Library, Firebase Emulator rules tests.

## Global Constraints

- 施設メモはタイトルなし、複数件、編集・削除可能とする。
- Markdownは入力中にプレビューせず、保存後の表示時だけレンダリングする。
- 施設メモと訪問メモの本文上限は各2000文字のまま維持する。
- 既存の1施設1メモFirestoreドキュメントを読み取れるようにする。
- 危険なHTML・スクリプト・javascript URLは表示しない。
- 変更後は `npm test -- --run`、`npm run lint`、`npm run build` を実行する。

---

### Task 1: Markdownレンダラーを追加する

**Files:**
- Create: `src/markdown.ts`
- Create: `src/markdown.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interface:** `renderMarkdown(source: string): string` はMarkdownをHTMLへ変換し、サニタイズ済みHTMLだけを返す。

- [x] **Step 1: 失敗テストを書く**

```ts
it("renders markdown and removes unsafe HTML", () => {
  const html = renderMarkdown("# 見出し\n\n- **重要**\n- [公式](https://example.com)\n\n<script>alert(1)</script>");
  expect(html).toContain("<h1>見出し</h1>");
  expect(html).toContain("<strong>重要</strong>");
  expect(html).toContain('href="https://example.com"');
  expect(html).not.toContain("script");
});
```

- [x] **Step 2: REDを確認する**

Run: `npm test -- --run src/markdown.test.ts`

Expected: `./markdown`または`renderMarkdown`が未実装で失敗する。

- [x] **Step 3: 実装する**

`marked.parse`の結果を`DOMPurify.sanitize`へ渡す。raw HTML・イベント属性・危険な埋め込みタグを禁止する。

```ts
import DOMPurify from "dompurify";
import { marked } from "marked";

export function renderMarkdown(source: string) {
  const html = marked.parse(source, { gfm: true, breaks: true, async: false });
  return DOMPurify.sanitize(String(html), {
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed"],
    FORBID_ATTR: ["style", "onerror", "onclick", "onload"],
  });
}
```

- [x] **Step 4: GREENを確認する**

Run: `npm test -- --run src/markdown.test.ts`

Expected: Markdown・日本語・絵文字・危険HTMLのテストがpassする。

### Task 2: 施設メモストアを複数件対応に変更する

**Files:**
- Modify: `src/facilityNotes.ts`
- Create: `src/facilityNotes.test.ts`
- Modify: `tests/facilityNotes.integration.test.ts`
- Modify: `firestore.rules`
- Modify: `tests/firestore.rules.test.ts`

**Interfaces:**
- `FacilityNote` は `id`, `facilityId`, `text`, `createdAt`, `updatedAt` を持つ。
- `FacilityNoteMap` は `Record<string, FacilityNote[]>`。
- `FacilityNoteStore` は `create(facilityId, text)`, `update(noteId, facilityId, text)`, `remove(noteId)`, `subscribe` を提供する。
- 旧ドキュメントはドキュメントIDを施設IDとして正規化する。

- [x] **Step 1: 旧形式・新形式・空文字の失敗テストを書く**

同一施設に2件が返ること、旧形式のID補完、空文字編集が削除になること、2000文字超過が拒否されることを検証する。Firestore Emulatorテストには新形式の作成・更新・削除と別世帯拒否を追加する。

- [x] **Step 2: REDを確認する**

Run: `npm test -- --run src/facilityNotes.test.ts`

Expected: 現在の単一メモAPIと新テストの型・挙動が一致せず失敗する。

- [x] **Step 3: ストアとルールを実装する**

新規作成は`addDoc`、編集は`updateDoc`、空文字は`deleteDoc`を使う。購読時は全ドキュメントを施設IDごとにまとめ、`updatedAt`降順で返す。ルールは新形式の`facilityId`、`createdAt`、`updatedAt`、本文長を検証し、旧形式の読み取り・削除を維持する。

- [x] **Step 4: GREENを確認する**

Run: `npm test -- --run src/facilityNotes.test.ts`

Run: `npm run test:rules`

Expected: ストアとFirestoreルールのテストが全件passする。

### Task 3: エクスポートを複数メモ対応にする

**Files:**
- Modify: `src/buildExport.ts`
- Modify: `src/buildExport.test.ts`
- Modify: `src/App.test.tsx`

- [x] **Step 1: 失敗テストを書く**

同一施設の2件のメモが、各`id`・`facilityId`・本文・作成日時・更新日時を保持して出力されることを検証する。schemaVersion期待値を3へ更新する。

- [x] **Step 2: REDを確認する**

Run: `npm test -- --run src/buildExport.test.ts`

Expected: 現在の単一メモ型またはschemaVersion 2との不一致で失敗する。

- [x] **Step 3: 実装してGREENを確認する**

`Object.values(facilityNotes).flat()`で全メモを配列化し、施設ID・更新日時・IDで安定ソートする。

Run: `npm test -- --run src/buildExport.test.ts`

Expected: 全件passする。

### Task 4: 詳細画面の施設メモCRUDとMarkdown表示を実装する

**Files:**
- Modify: `src/VisitPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [x] **Step 1: 失敗テストを書く**

施設メモを2件追加し、各メモを編集・削除できることをテストする。訪問メモと施設メモで太字・箇条書き・リンクがHTML表示され、scriptが表示されないことも検証する。

- [x] **Step 2: REDを確認する**

Run: `npm test -- --run src/App.test.tsx -t "施設メモ|訪問メモ"`

Expected: 現在の`FacilityNoteStore`が複数件CRUDに対応していないため失敗する。

- [x] **Step 3: CRUD UIを実装する**

施設メモを`ul`で列挙し、「メモを追加」「編集」「削除」を実装する。編集フォームは1件だけ開き、保存・削除中の操作を無効化する。削除は確認ダイアログを通す。更新日は低コントラストの`small`で表示する。

- [x] **Step 4: Markdown表示を実装する**

訪問メモと施設メモの表示箇所で`renderMarkdown`の結果だけを`dangerouslySetInnerHTML`へ渡す。textareaには原文を表示し、空文字メモは表示しない。

- [x] **Step 5: GREENを確認する**

Run: `npm test -- --run src/App.test.tsx -t "施設メモ|訪問メモ"`

Expected: 追加・編集・削除・Markdown表示テストが全件passする。

### Task 5: スタイルと全体検証を仕上げる

**Files:**
- Modify: `src/styles.css`
- Modify: `src/styles.test.ts`

- [x] **Step 1: スタイルを追加する**

施設メモのリスト・カード・操作ボタン・Markdown本文の見出し・リスト・リンク・段落余白を既存UIへ合わせる。更新日は既存より小さく薄くする。

- [x] **Step 2: スタイルテストを更新する**

既存のカードスタイル検証を維持し、施設メモとMarkdown表示のクラスを検証する。

- [x] **Step 3: 全検証を実行する**

Run: `npm test -- --run`

Run: `npm run test:data`

Run: `npm run lint`

Run: `npm run build`

Expected: 全テスト、データ検証、型チェック、Vite/PWA buildがpassする。

- [x] **Step 4: 差分形式を確認する**

Run: `git diff --check`

Expected: 出力なし。
