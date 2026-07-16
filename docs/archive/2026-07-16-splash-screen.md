# スプラッシュスクリーン Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** アプリ起動時（ブラウザ訪問・PWA 起動とも）の「無地の白画面」区間をなくし、ブランドを見せるスプラッシュスクリーンから本体へ滑らかにフェード遷移する。

**Architecture:** `index.html` に静的スプラッシュ（`#root` の前の `<div id="splash">` ＋ head 内のインライン `<style>`・`<script>`）を置く。スプラッシュのライフサイクル（開始時刻記録・最低表示時間・フェード・DOM 除去・タイムアウト UI）は**すべて index.html のインラインスクリプトに集約**し、React 側（`AuthGate`）は認証状態が確定した時点で `app:splash-ready` イベントを送出するだけにする。React 19 の StrictMode で Effect が二重実行されても、受信側の解除処理が冪等なので安全。

**Tech Stack:** React 19、TypeScript、Vite 7（`%BASE_URL%` 変換）、vite-plugin-pwa、Vitest、Testing Library

## Global Constraints

- 既存の auth-loading（`AuthGate` の `signedIn === undefined` 分岐、`.auth-pulse`）の挙動・見た目は変えない。スプラッシュが上に被さるだけで、解除後は従来どおり
- 新しい依存関係を追加しない
- スプラッシュの CSS・JS は外部ファイルに依存させない（バンドル読込前に表示されるため、すべて index.html にインライン）
- 人工的な長い待ち時間を入れない（最低表示はフラッシュ防止の 600ms のみ）
- iOS `apple-touch-startup-image` の全サイズ生成はスコープ外（要望が出たら別途）

## 設計

### 見た目（既存デザイントークンを流用）

- 背景: `#173f35`（主色の深緑。`theme-color`・認証画面背景と同色で、アドレスバー〜auth-loading と地続きに見える）
- 中央: アプリアイコン。`assets/icon.svg`（512×512 viewBox・肉球モチーフ・ブランド配色）をインライン SVG 化する。背景 `<rect>` がスプラッシュ背景と同色で沈むため、`rx="112"` 程度の角丸を付けてタイル化し、細い縁取り（`#a8d8d7` 系の半透明 border）で浮かせる。インライン化に問題が出た場合のフォールバックは `<img src="%BASE_URL%pwa-192x192.png" alt="">`（favicon と同じ `%BASE_URL%` 方式で base パス `/zoo-aquarium-log/` に対応）
- アイコン下: eyebrow「FAMILY FIELD NOTE」（小・字間広め・`#a8d8d7`）＋アプリ名「動物園・水族館ログ」（太字・`#f7f4e8`）
- 下部: 既存 `.auth-pulse` と同じ見た目のパルスドット（`#a8d8d7`、box-shadow 拡散 1.3s infinite）。クラス名は衝突を避け `splash-pulse` とする
- フォント: `"Hiragino Sans", "Yu Gothic UI", system-ui, sans-serif`（LINE Seed JP は Web フォント読込前のため使わない）

### ライフサイクル（インラインスクリプトが管理）

状態遷移: `visible → waiting → hiding → removed`（＋異常系 `stalled`）。現在状態は `#splash` の `data-splash-state` 属性に反映する。

- **開始時刻**: `<head>` のインラインスクリプト冒頭で `performance.now()` を記録（React マウント時刻ではなくページ表示時刻を起点にするため）
- **解除条件**: `window` で `app:splash-ready` イベントを受信
- **フェード開始時刻** = `max(ready 受信時刻, 開始時刻 + 600ms)`。600ms は**フェード開始までの**最低表示時間（フェード 400ms を含めると最短で計約 1 秒表示）。キャッシュ済みで即マウントされた場合の一瞬のフラッシュを防ぐ
- **フェードアウト**: opacity transition 400ms。DOM 除去は `transitionend`（`event.target === splash && event.propertyName === "opacity"` を確認）＋フォールバックタイマー 500ms の両建てで、`prefers-reduced-motion` などで transition が走らない環境でも確実に消す
- **冪等性**: 解除関数は状態を確認してから進める（複数回呼ばれても二重実行されない）。タイマー・リスナーは解除時に片付ける
- **タイムアウト（10 秒）**: ready が届かない場合、強制フェードは**しない**（React がクラッシュしていたら白画面を晒すだけのため）。スプラッシュ内を `stalled` 状態に切り替える — メッセージを「読み込みに時間がかかっています」にし、`location.reload()` する「再読み込み」ボタンを表示、パルス停止、メッセージ要素を `role="alert"` に。その後 ready が届けば通常のフェード解除に進めてよい
- **アクセシビリティ**: `role="status"` はスプラッシュ全体ではなく状態メッセージ要素（「読み込んでいます」テキスト）に付与。アイコン・パルスは `aria-hidden="true"`
- **reduced-motion**: `prefers-reduced-motion: reduce` でパルスアニメーション停止

### 依存関係（保守時の注意）

スプラッシュ解除は `AuthGate` からの `app:splash-ready` 送出に依存する。**AuthGate を改修・置換する際はイベント送出を残すこと**（送出が消えても 10 秒で stalled 状態になるため固まりはしないが、毎回タイムアウト画面になる）。

---

### Task 1: AuthGate から準備完了イベントを送出

**Files:**
- Modify: `src/AuthGate.tsx`
- Modify: `src/AuthGate.test.tsx`（存在しない場合は `src/App.test.tsx` の AuthGate 関連テストに追加）

**Interfaces:**
- Consumes: 既存の `signedIn` state（`undefined` = 未確定）
- Produces: 認証状態確定時（`signedIn !== undefined`、true/false どちらでも）に `window.dispatchEvent(new CustomEvent("app:splash-ready"))` を 1 回送出

- [ ] **Step 1: 失敗テストを書く**

認証状態が確定（サインイン済み・未サインインの両ケース）したら `app:splash-ready` が window に dispatch されることを検証するテストを追加する。`window.addEventListener` のスパイ、またはテスト内でリスナーを張って受信を確認する形でよい。

- [ ] **Step 2: 失敗テストを実行する**

Run: `npm test -- --run src/AuthGate.test.tsx`

Expected: イベントが送出されないため FAIL する。

- [ ] **Step 3: 実装する**

`AuthGate` に `useEffect` を追加する:

```tsx
useEffect(() => {
  if (signedIn !== undefined) {
    window.dispatchEvent(new CustomEvent("app:splash-ready"));
  }
}, [signedIn]);
```

StrictMode の二重実行で 2 回 dispatch されても、受信側（Task 2 のインラインスクリプト）が冪等なので問題ない。

- [ ] **Step 4: テストを通す**

Run: `npm test -- --run`

Expected: 全テスト PASS。

### Task 2: index.html にスプラッシュ本体を追加

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `app:splash-ready` イベント（Task 1）、`assets/icon.svg` の SVG マークアップ（インライン化して埋め込む）
- Produces: `#splash` オーバーレイと、上記「ライフサイクル」節の状態機械を実装したインラインスクリプト

- [ ] **Step 1: マークアップと CSS を追加**

`<body>` 直下・`#root` の前に:

```html
<div id="splash" data-splash-state="visible">
  <svg><!-- assets/icon.svg をインライン化（rect に rx を付与） --></svg>
  <p class="splash-eyebrow" aria-hidden="true">FAMILY FIELD NOTE</p>
  <p class="splash-title">動物園・水族館ログ</p>
  <p class="splash-status" role="status">読み込んでいます</p>
  <span class="splash-pulse" aria-hidden="true"></span>
  <button type="button" class="splash-reload" hidden>再読み込み</button>
</div>
```

`<head>` のインライン `<style>` に: 全画面固定（`position: fixed; inset: 0`）、`z-index` はアプリより上、背景 `#173f35`、中央寄せ（grid）、opacity transition 400ms、`[data-splash-state="hiding"] { opacity: 0 }`、`[data-splash-state="stalled"]` でパルス非表示・再読み込みボタン表示、`@media (prefers-reduced-motion: reduce)` でアニメーション停止。

- [ ] **Step 2: ライフサイクルスクリプトを追加**

`<head>` のインライン `<script>` に「ライフサイクル」節の状態機械を実装する（開始時刻記録 → `app:splash-ready` リスナー → `max(ready, start+600ms)` でフェード開始 → `transitionend`＋フォールバックタイマーで remove → 10 秒で stalled）。

- [ ] **Step 3: 目視確認**

Run: `npm run dev` ＋ DevTools ネットワークスロットリング（Slow 3G）

Expected: スプラッシュが即表示され、読み込み完了後にフェードアウトして本体（ログイン画面 or アプリ）が現れる。キャッシュ有効の再訪問でも一瞬のフラッシュにならない（600ms の効き）。

- [ ] **Step 4: 異常系の確認**

一時的に AuthGate のイベント送出をコメントアウトし、10 秒後に「読み込みに時間がかかっています」＋再読み込みボタンが出ること、ボタンでリロードできることを確認。確認後に戻す。

### Task 3: manifest background_color の変更

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: `background_color` を `"#f7f4e8"` → `"#173f35"` に変更**

Android の PWA ネイティブスプラッシュ → インラインスプラッシュが同色で繋がる。iOS のネイティブ起動画面はこの値では制御できない（スコープ外）。

### Task 4: ビルド検証

- [ ] **Step 1: 静的チェックとテスト**

Run: `npm run lint && npm test -- --run && npm run build`

Expected: すべて成功。

- [ ] **Step 2: dist の確認**

- `dist/index.html` に `%BASE_URL%` が残っていない（フォールバック PNG を使った場合）
- `dist/sw.js` の index.html の precache revision が変わっている（インライン CSS/JS 追加で自動更新される）

- [ ] **Step 3: base パス込みのプレビュー**

Run: `npm run build && npx vite preview`

Expected: `/zoo-aquarium-log/` 配下でスプラッシュが正しく表示・解除される。

- [ ] **Step 4: デプロイ後のスマホ実機確認**

PWA インストール済み端末で起動し、ネイティブスプラッシュ（深緑）→ インラインスプラッシュ → 本体の色の繋がりを確認。既存インストール分には manifest 変更が即反映されない場合があるため、再インストールでも確認する。

---

## 実装時に要確認（着手前にユーザーへ）

- 最低表示時間 600ms（＋フェード 400ms、最短計約 1 秒）は演出として十分か。ブランドをしっかり見せたいなら延長可
- アイコンはアプリアイコン（肉球）流用でよいか、スプラッシュ専用のロゴ・イラストを作るか

## 備考

- 本プランは 2026-07-16 に Codex レビュー（条件付き承認）を反映済み: StrictMode 前提の冪等化（イベント方式への変更）、最低表示時間の起点をページ表示時刻へ、タイムアウト時は強制フェードでなく再読み込み UI、`transitionend` のフォールバック、検証項目の拡充
- 将来 auth-loading（「記録を読み込んでいます」画面)とスプラッシュを一本化したくなった場合は、auth-loading 分岐を削り splash の解除タイミングを遅らせる方向で検討する（現時点では最小差分を優先して両方残す）
