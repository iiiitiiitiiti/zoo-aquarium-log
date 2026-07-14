# zoo-aquarium-log ステップ11: PWA化＋本番デプロイ（通し確認）

## Context

`docs/plan.md` の実装ステップ11（合意済み実装順 6→10→7→8→9→11 の最終ステップ）。要件: PWA 化し、スマホ実機で「ホーム画面追加→合言葉→記録→同期」の通し確認。plan.md で確定済みの方針: base / manifest / SW スコープの一致、新バージョン検知→自動リロード、OSM タイルは precache しない、オフライン保証範囲は「アプリシェルの起動まで」（Firestore 未取得データのオフライン閲覧は保証しない）。

前提（2026-07-15 にコード実地確認済み）:

- Vite 7・React 19・vitest 3。`vite.config.ts` は `base: "/zoo-aquarium-log/"`
- デプロイは GitHub Actions（`deploy-pages.yml`: テスト → `npm run build` → upload-pages-artifact → deploy-pages）。dist は git 管理外
- PWA 関連は完全未実装（manifest・Service Worker・`public/` ディレクトリのいずれも存在しない）
- index.html に `theme-color #173f35` 設定済み。styles.css は Google Fonts（LINE Seed JP）を fonts.googleapis.com から読み込む
- main.tsx はモジュールトップでストア生成 → StrictMode で App を render。**SW 登録もモジュールトップで行えば StrictMode の二重実行の影響を受けない**
- `tests/pages-config.test.mjs` が workflow・base・フォント読込を静的検証している（拡張対象）
- 着手は 8・9 のマージ後（合意順）。precache 対象はその時点の dist 内容（Leaflet 込み）に自動追従する

このプランの正本はリポジトリ内 `docs/2026-07-15-step11-pwa-deploy.md` に置く。

## ライブラリ選定

**vite-plugin-pwa ^1.x（devDependency）＋ Workbox generateSW** を採用。

- peerDependencies が `vite: ^7.0.0` を明示サポート（公式リポジトリの package.json で確認済み。workbox-build / workbox-window は ^7.4.1）
- **不採用: 手書き SW** — Vite はアセットをハッシュ付きファイル名で出力するため、precache リストの生成にはビルド統合が必須。自作は「旧キャッシュ残留」（plan.md が最も警戒する事故）のバグ源になる
- **不採用: manifest のみ（SW なし）** — アプリシェルのオフライン起動ができず、plan.md の保証範囲を満たさない
- **不採用: injectManifest（カスタム SW）** — 本アプリに独自の fetch 制御要件がなく generateSW で足りる（YAGNI）

## 設計要点

### 1. SW 更新戦略 = `registerType: 'prompt'` ＋ 自前の「安全タイミング自動適用」（Codex レビューで変更）

plan.md の方針「新バージョン検知→自動リロード」の趣旨（旧キャッシュを残さない）は維持しつつ、**入力中の自動リロードによる入力喪失は許容しない**（当初案の `autoUpdate` は、公式ガイド自身がフォームを持つアプリに非推奨としており、保存前のメモ・評価・写真選択が React state 上にあるため消える）。

- `registerType: 'prompt'` を使い、**ユーザーに更新ボタンは見せない**。新 SW の waiting 検知（`onNeedRefresh`）で新規 `src/swUpdate.ts`（純 TS の小さなコントローラ）へ通知し:
  - **編集パネル（VisitPanel / AddFacilityPanel）が開いていなければ即座に `updateServiceWorker()` を呼ぶ** → SKIP_WAITING → controlling で自動リロード（UX は autoUpdate と同じ）
  - **編集パネルが開いている間は適用を保留**し、パネルが閉じた時点で適用する。App は パネル open/close の変化を `swUpdate.setEditing(bool)` で通知する（dirty 判定より粗いが安全側・実装が単純）
- `src/main.tsx` のモジュールトップで `virtual:pwa-register` の `registerSW({ immediate: true, onNeedRefresh, onRegisteredSW })` を登録（StrictMode の影響なし）
- `onRegisteredSW` で **60分間隔の更新チェック**。公式の Periodic SW Updates パターンに従い、`navigator.onLine` 確認・`fetch(swUrl, { cache: "no-store" })` での事前到達確認・try/catch を入れる（オフライン・サーバー停止時に例外で壊れない）
- `swUpdate.ts` は純 TS でユニットテスト対象（編集中→保留→閉じたら適用、非編集→即適用、の真理表）

### 2. キャッシュ境界（何をキャッシュし、何に触らないか）

| 対象 | 方針 |
|---|---|
| dist 内の html / js / css / アイコン | precache（globPatterns 既定）。facilities.json は JS バンドルに内包されるため自動的に含まれる。**手動リンクする apple-touch-icon・favicon は `includeAssets` で明示**（Workbox 既定の glob は html/js/css 中心のため） |
| **OSM タイル** | **runtimeCaching を一切設定しない**（OSM の precache 禁止ポリシー＋plan.md 方針。クロスオリジン要求は既定では SW がキャッシュしないことを preview の Cache Storage で確認する） |
| **Firestore / Auth / Storage（写真）** | **Workbox の runtime cache に入れない**（Firestore SDK 自身のキャッシュとは別の話）。ストリーミング接続（WebChannel）に SW キャッシュを挟むと同期が壊れる。既定のまま素通し |
| Google Fonts | runtimeCaching を追加: fonts.googleapis.com の CSS = StaleWhileRevalidate、fonts.gstatic.com の woff2 = CacheFirst（1年・上限10件）。オフラインシェルの見た目を保つ定番設定 |

- `navigateFallback: index.html`（プラグインが base を自動反映。SPA 1ページ構成のため denylist 不要）

### 3. manifest

- `name`「動物園・水族館ログ」（index.html の title と一致）、`short_name` は未確定（後述）、`lang: "ja"`、`display: "standalone"`
- `start_url` / `scope` はプラグインが vite の `base` から解決する既定に任せる（`scope = options.scope || basePath` を公式実装で確認済み → plan.md の「base/manifest/SW スコープ一致」を設定漏れなく満たす）。**`id` は既定値が存在しないため `"/zoo-aquarium-log/"` を明示**し、build 後の `dist/manifest.webmanifest` の実物で id / start_url / scope / icons を検証する
- `theme_color: "#173f35"`（index.html の theme-color と一致）、`background_color: "#f7f4e8"`（アプリシェルの地色）
- icons: 192 / 512 / maskable 512 の PNG ＋ apple-touch-icon 180。index.html に手動追加する link は **`href="%BASE_URL%apple-touch-icon.png"`**（Vite が base へ置換。`/apple-touch-icon.png` 直書きは GitHub Pages でリポジトリルートを指してしまう）
- **アイコン画像は SVG 1枚を正**とし、`@vite-pwa/assets-generator`（npx 一回実行・依存追加なし）で各サイズ PNG を `public/` へ生成してコミット。モチーフは未確定（要ユーザー確認。仮案: 深緑 #173f35 地にクリーム #f7f4e8 の肉球＋魚のシルエット）

### 4. 更新確認のためのバージョン表示

vite の `define` で `__APP_VERSION__`（ビルド日時＋コミット短SHA）を埋め込み、「その他の操作」パネル末尾に小さく表示する。自動リロード更新が効いていることを実機で確認する手段（完了定義4）であり、旧キャッシュ残留の切り分けにも使う。

### 5. TS / テスト整合

- tsconfig の types へ `"vite-plugin-pwa/client"` を追加（`virtual:pwa-register` の型解決）
- `tests/pages-config.test.mjs` を拡張: vite.config.ts に `VitePWA` と manifest の `id` があること、index.html の apple-touch-icon が `%BASE_URL%` 参照であることの静的検証を追加
- **pages-config.test.mjs は現在どのテストコマンドからも実行されていない**（`test:data` は facilities.test.mjs のみ・vitest は src/ のみが対象。CI でも未実行）→ `test:data` を `node --test tests/facilities.test.mjs tests/pages-config.test.mjs` に拡張して CI（deploy-pages.yml が呼ぶ `npm run test:data`）の実行経路に載せる
- `devOptions` は無効のまま（開発時は SW を動かさない。SW の検証は build＋preview で行う — dev 中の SW はキャッシュ起因の混乱の方が大きい）

## 変更ファイル一覧

**新規**: `public/`（pwa-192x192.png / pwa-512x512.png / maskable-icon-512x512.png / apple-touch-icon.png / favicon）、アイコン生成元 SVG（例 `assets/icon.svg`）、`src/swUpdate.ts`（＋`src/swUpdate.test.ts`）

**変更**: `package.json`（vite-plugin-pwa devDep 追加・`test:data` に pages-config.test.mjs を追加）、`vite.config.ts`（VitePWA 設定・define）、`index.html`（apple-touch-icon link）、`src/main.tsx`（registerSW＋swUpdate 配線）、`src/App.tsx`＋`src/styles.css`（バージョン表示・`swUpdate.setEditing` 通知）、`tsconfig.app.json`（types）、`tests/pages-config.test.mjs`（検証拡張）

**変更不要**: `.github/workflows/deploy-pages.yml`（dist をそのままアップロードするため sw.js / manifest.webmanifest も自動で配信される）、`firestore.rules`、各ストア

## 実装順序（コミット単位）

1. アイコン素材（SVG 作成 → PNG 生成 → public/ 追加。挙動変更なし） → `npm run build` green
2. vite-plugin-pwa 導入＋manifest＋workbox 設定 → build で dist に `sw.js` / `manifest.webmanifest` が出力され、**manifest 実物の id / start_url / scope / icons がサブパス込みで正しい**ことを確認
3. `src/swUpdate.ts` ＋ テスト（純 TS・SW 非依存） → `npm run test` green
4. main.tsx の registerSW＋App の setEditing 配線＋バージョン表示＋index.html → build＋preview で SW の動作確認
5. pages-config.test.mjs 拡張＋`test:data` への組み込み → `npm run test`・`npm run test:data` 全 green

## 検証（完了の定義）

1. `npm run test`・`npm run test:data`・`npm run lint`・`npm run build` 全パス
2. `npm run build` → `npx vite preview` で: DevTools Application タブで manifest の内容（id / start_url / scope / icons）・SW が activated・**Cache Storage に OSM / googleapis 系の URL が無い**こと・apple-touch-icon / favicon / manifest / sw.js がすべて base 配下の URL で 200 になること。Lighthouse の installable 判定
3. デプロイ後、**実機（Android と iOS の両方）**で plan.md の通し確認: ホーム画面追加 → standalone 起動（ブラウザ UI なし）→ 合言葉 → 記録追加 → 別端末で同期確認
4. **更新フロー（サイトデータ削除なしの2リリース検証）**: 軽微変更を再デプロイ → インストール済みアプリを開き直し、バージョン表示が新しくなる（自動適用が機能する）ことを確認。さらに**編集パネルを開いたまま更新を待機させ、入力が失われず、パネルを閉じた後に新バージョンへ切り替わる**ことを確認
5. **機内モードで再起動** → アプリシェルが起動する（データ取得はエラー表示で可 — plan.md の保証範囲どおり）。60分チェックがオフラインで例外を出さないこと（console にエラーが出ない）

## リスク・注意点

1. **旧キャッシュ残留**（plan.md の最重要懸念） → 安全タイミングでの自動適用＋60分間隔チェック＋バージョン表示で検知可能にする。最終復旧手段は「ブラウザのサイトデータ削除」を README に記載
2. **入力中の自動リロードによる入力喪失** → swUpdate コントローラで編集パネル表示中は適用を保留する設計に変更済み（Codex レビュー反映）。パネル open/close 単位の粗い判定のため「パネルを開いただけで未入力」でも保留されるが、安全側に倒す
3. **iOS の挙動差**: ホーム画面追加は共有シートから手動（自動インストールプロンプトなし）。SW・manifest は iOS 16.4 以降で安定サポート。通し確認は iOS / Android 両方で行う
4. **vite-plugin-pwa のバージョン**: 実装時点の最新 1.x を採用し、workbox peer 要件（^7.4.1）を満たすこと。npm 7+ は peerDependencies を自動インストールするが、`npm ls workbox-build` で確認する
5. **precache サイズ**: ステップ8の Leaflet 導入後はバンドルが増える → build 時に precache 合計サイズを確認（数百 KB 想定・許容）。写真（Firebase Storage）はクロスオリジンで precache 対象外

## モデル采配（規律7）

| 作業 | 担当 |
|---|---|
| 設計・プラン（本作業） | Fable（メイン） |
| 実装1〜4（方針決定済みの実装） | Sonnet サブエージェント（deep-code 経由） |
| ビルド・テスト実行・preview 確認 | メインで直接（軽作業） |
| 実機通し確認 | ユーザー（実機操作）＋ Fable（結果判定） |

変更は9ファイル前後のため実装時は **deep-code** を呼ぶ。

## 未確定事項（実装開始時に決める）

- `short_name`（ホーム画面のラベル。全角8文字以内目安。仮案:「どうぶつログ」）
- アイコンのモチーフ・配色（仮案を提示して確認）
- バージョン表示の形式（推奨: ビルド日時＋短SHA）

## Codex レビュー

2026-07-15 に codex-skill（gpt-5.6-luna, reasoning effort: xhigh）でレビュー実施。「そのままでは未承認 — 入力喪失の許容判断が弱く、パス設定とテスト実行経路に修正が必要」との評価。Codex はリポジトリ実コード（VisitPanel の React state・package.json のテスト経路・deploy-pages.yml）と公式資料（vite-plugin-pwa の auto-update / periodic-sw-updates / precache ガイド、公式ソース options.ts）を確認して裁定。指摘反映後の再設計が本文。

**反映した指摘**:
- **入力中の自動リロードを「稀・許容」としない**（公式ガイド自身がフォームを持つアプリに autoUpdate を非推奨。保存前のメモ・評価・写真選択は React state 上でリロードで消える） → `registerType: 'prompt'` ＋ 新規 `src/swUpdate.ts` による**安全タイミング自動適用**（非編集時は即適用＝plan.md の自動リロード方針を維持、編集パネル表示中は閉じるまで保留）に設計変更
- **60分チェックの防御不足** → 公式 Periodic SW Updates パターンどおり `navigator.onLine`・`fetch(swUrl, {cache:"no-store"})`・try/catch を追加
- **manifest の `id` に既定値はない**（公式ソースで既定が確認できるのは start_url / scope のみ） → `id: "/zoo-aquarium-log/"` を明示し、build 後の manifest 実物検証を実装順序・完了定義に追加
- **apple-touch-icon の絶対パス直書きは Pages でルートを指す** → `%BASE_URL%` 参照に変更
- **手動リンクのアイコン・favicon は既定 glob の precache に入らない** → `includeAssets` で明示
- **pages-config.test.mjs がどのテストコマンドからも実行されていない**（CI 未実行の既存問題） → `test:data` へ組み込んで deploy-pages.yml の実行経路に載せる
- **「Firestore をキャッシュしない」の表現** → 「Workbox の runtime cache に入れない」（SDK 自身のキャッシュとは別）に修正。現状 Firestore の明示的な永続化設定はなく SW と干渉しないことも確認済み
- 検証に「サイトデータ削除なしの2リリース検証」「編集パネルを開いたまま更新待機→入力保持→閉後切替」「base 配下 URL の 200 確認」を追加

**見送った指摘と理由**:
- **フォーム下書きの sessionStorage / IndexedDB 退避＋リロード後復元**: 更新保留方式を採用したため不要。Codex 自身も写真ファイルの復元まで含めると複雑と評価しており、保留方式の方が単純で安全
- **ユーザーに更新プロンプトを見せる標準の prompt UX**: plan.md の確定方針は「自動リロード」であり、家族向けアプリに更新ボタンの判断を持ち込まない。prompt は検知機構としてのみ使い、適用は自動で行う
