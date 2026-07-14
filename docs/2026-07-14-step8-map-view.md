# zoo-aquarium-log ステップ8: 地図画面（Leaflet + OpenStreetMap）

## Context

`docs/plan.md` の実装ステップ8。合意済みの実装順（6→10→7→8→9→11）で、6・10は実装済み、7は実行プラン承認済み（実行はGate 1承認待ち）。plan.md の要件: 「Leaflet + OSM、訪問状態で色分けピン、クラスタリング、OSM 帰属表示」。

前提（HEAD `54e66d4` 時点でコード実地確認・ライブラリ事実はWeb検索で確認済み）:
- App.tsx はルーターなしの state 分岐（facilityEditorOpen → AddFacilityPanel / selectedFacility → VisitPanel / 他 → 一覧）。地図も同パターンで追加
- App は visits 全件・marks・customFacilities・visitedIds（useMemo派生）・フィルタ state を保持済み。`filterFacilities` は無改修で地図に再利用可能
- 依存は firebase/react/react-dom のみ。`.app-shell` は最大幅480pxのスマホファースト
- **注意**: working tree に別セッションの未コミット変更あり（クイックアクションを「その他の操作」`<details>` パネルへ収納する変更等）。実装着手時は最新の main を pull し、その時点のコードに合わせて配線すること
- エントリポイントはユーザー決定済み（2026-07-15）: **一覧見出し行（`.results-heading`）に常設ボタン**

このプランの正本はリポジトリ内 `docs/2026-07-14-step8-map-view.md` に置く（承認後に格納）。

## ライブラリ選定（Web検索で2026年時点の事実を確認済み）

**plain Leaflet（useEffect/useRef で直接操作）＋ leaflet.markercluster ＋ L.divIcon の色付き丸ピン。react-leaflet は不採用。**

- **react-leaflet 不採用の理由**: v5 は React 19 対応済みだが、本アプリは Firebase も素の SDK をクラスで直接叩く流儀であり、地図1画面のために抽象化層＋追加 peer 依存（@react-leaflet/core、クラスタは更に react-leaflet-cluster）を導入する価値が薄い。plain Leaflet ならプラグイン1つで済む
- **leaflet.markercluster 採用**: 公式 Leaflet Organization 配下。現行 Leaflet は 1.9.4（2.0未リリース）で互換問題なし。**npm 最新 1.5.3 は2021-10が最終公開**という保守リスクは「枯れて安定」と評価して許容（家族数人・300〜500件規模）。Leaflet 2.0 移行時の再検証を申し送り。supercluster はマーカー再描画の自前実装が必要で過剰につき不採用
- **ピンは L.circleMarker でなく L.divIcon**（重要）: circleMarker は leaflet.markercluster と**組み合わせ不可**（L.Marker 専用の既知制限。Leaflet.markercluster#183）。divIcon（CSS の `border-radius:50%`＋背景色）を L.Marker に持たせる方式なら、クラスタ互換かつ **Vite で定番の「本番ビルドで marker-icon.png が404」問題を丸ごと回避**（L.Icon.Default を一度も使わないため画像アセット設定が一切不要）
- バンドル増: leaflet 本体 gzip 約39KB(JS)＋4KB(CSS)、markercluster 数KB。許容範囲

```json
"dependencies": { "leaflet": "^1.9.4", "leaflet.markercluster": "^1.5.3" }
"devDependencies": { "@types/leaflet": "^1.9.x", "@types/leaflet.markercluster": "^1.5.6" }
```

## 設計要点

### 1. 画面構成（新規 `src/MapPanel.tsx`）

- 既存の全画面切替パターンを踏襲。App.tsx に `mapOpen: boolean` を追加し分岐
- ヘッダー: 「← 施設一覧」戻るボタン（`back-button` 流用）＋**凡例**（色チップ＋テキストラベル横並び。色のみに依存しない）
- 地図本体: 地図画面のみ `height:100dvh; overflow:hidden` のビューポート固定（`.map-shell` 修飾クラス。既存 `.app-shell` の min-height 伸縮方針は他画面に影響させない）。`.map-canvas{flex:1;min-height:0}` に Leaflet をマウント。`overscroll-behavior:contain` で iOS の pull-to-refresh 干渉を防止
- **Effect の分離（StrictMode 対応・Codex 指摘で明文化）**:
  - **初期化 Effect**（依存配列に shown/marks を入れない）: `L.map()`・タイルレイヤー・MarkerClusterGroup を1回だけ生成。**cleanup で必ず `map.remove()` と ref のクリア**（main.tsx は StrictMode で包まれており、開発時の setup→cleanup→setup 二重実行で「Map container is already initialized」になるのを防ぐ）。初期化直後に `map.invalidateSize()`
  - **マーカー更新 Effect**: snapshot 更新（marks トグル等）時は **map を作り直さず MarkerClusterGroup のみ clearLayers→addLayers で再構築**（300〜500件規模なら十分。markercluster 公式も1万件超を扱える設計）。**現在のズーム・中心・開いているポップアップを壊さない — `fitBounds` は初回表示時のみ**
  - `resize` / `visualViewport.resize` で `map.invalidateSize()`（iOS Safari のアドレスバー伸縮・画面回転対応）
- **一覧のフィルタ状態をそのまま適用**: フィルタ済み `shown` を props で渡す（「今絞り込んでいる一覧を地図で見る」体験。filterFacilities 無改修）
- **データ未取得時の誤表示防止**: visits/marks 購読完了前に開くと全施設が「未訪問」に見えるため、**「地図で見る」ボタンをデータ受信完了まで disabled**（既存の訪問状況フィルタ・エクスポートと同じ条件パターン）
- 初期表示範囲: `shown` の座標から `fitBounds(bounds, {padding:[24,24]})`。`shown.length === 1` は過剰ズーム防止で `setView(latlng, 12)`、`0` 件は日本全域（中心 36.5/137.5・zoom 5）＋空状態メッセージ

### 2. ピンの表示モデル（新規 `src/mapPins.ts`・純関数）— 二軸分離

当初案の「優先順位で単一色に丸める」方式は、訪問状態（visited/unvisited）とマーク状態（favorite/wishlist）という**別軸の情報を1色に潰し、未訪問のお気に入りで訪問状態が読めなくなる**ため不採用（Codex 指摘で変更。VisitPanel は訪問状態と無関係にマークを併用できる実装であることも確認済み）。

`pinAppearance(facility, visitedIds, marks)` が返す表示モデル:

| 軸 | 表現 | 色 |
|---|---|---|
| 訪問済み | **ピン本体色** | `#2f6b50`（営業中バッジと同じグリーン） |
| 未訪問 | **ピン本体色** | `#f7f4e8`／枠 `#9fb0a7`（中立トーン） |
| お気に入り | ピン右上の**★ミニバッジ** | `#2a7180`（主要アクセント） |
| 行きたい | ピン右上の**♡ミニバッジ** | `#d28a20`（評価の星と同じアンバー） |

- divIcon の HTML は本体丸＋バッジの組み合わせで生成（両マーク併存時は両方表示）。CSS のみで完結
- 凡例は「本体色2種＋バッジ2種」の4項目、色チップ＋テキストラベル必須（色のみに依存しない）
- クラスタアイコンは**状態を表さない中立色＋件数のみ**（内訳を混ぜない）。`disableClusteringAtZoom: 14〜15` 付近を指定し、ズームインでは素のピンを見せる
- 凡例データ・表示モデルとも純関数として export しテスト対象にする

### 3. ピン→詳細への導線

`bindPopup()`（施設名・種別・営業状態・訪問状況＋「詳細を見る」ボタン）。**ポップアップは HTML 文字列の埋め込みで作らず、`document.createElement`＋`textContent` で生成**（手動追加施設の名称はユーザー入力のため、テンプレートリテラル埋め込みは XSS になる — Codex 指摘で明文化。`bindPopup` は HTMLElement を直接受け取れる）。「詳細を見る」は実DOMの button に `L.DomEvent.on` でクリック登録し、props の `onSelectFacility(facility)` を発火。App 側は `setMapOpen(false); openFacility(facility);` で既存の一覧カードと同一の遷移経路へ接続。

### 4. エントリポイント（ユーザー決定済み）

`.results-heading`（施設件数の見出し行）に「地図で見る」常設ボタン（新規 `.map-toggle` クラス、`.location-button` と同系統の配色）。検索アコーディオンを開かなくても常に見える。「その他の操作」パネルには入れない（低頻度操作置き場のため）。

### 5. OSM タイルと帰属表示（利用ポリシー確認済み）

- タイルURL: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`（`{s}` サブドメイン分散は廃止方向・単一ホストが現行標準）
- `attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'` を必須設定（Tile Usage Policy 上の必須事項）
- User-Agent 要件はサーバー側バッチ取得向けで、ブラウザからの通常利用は対象外（ブラウザが自動付与・JSからの上書きは不可能）。家族数人の利用規模はポリシーの許容範囲
- タイルの事前キャッシュ（bulk prefetch）はポリシーで禁止 — plan.md の「OSMタイルは precache しない」方針と完全整合。追加対応不要

### 6. CSS/ビルドの注意

- `import "leaflet/dist/leaflet.css";` に加え、**クラスタ用の `leaflet.markercluster/dist/MarkerCluster.css` と `MarkerCluster.Default.css` も import**（Codex 指摘で明記。漏れるとクラスタが無スタイルで表示される）
- divIcon 方式のため L.Icon.Default の画像パス調整コードは不要
- GitHub Pages の `base:"/zoo-aquarium-log/"` はローカルアセットに自動反映。タイルは絶対URLで影響なし
- OSM ポリシーの付帯条件: Referer を止めない（restrictive な `Referrer-Policy` を設定しない — 現状の index.html に該当設定なし・確認済み）、ブラウザの通常キャッシュを妨げない、precache/prefetch をしない

## 変更ファイル一覧

**新規**: `src/mapPins.ts`（＋ `src/mapPins.test.ts`）、`src/MapPanel.tsx`（＋ `src/MapPanel.test.tsx`）

**変更**: `package.json`（依存4つ追加）、`src/App.tsx`（`mapOpen` state・分岐・見出し行ボタン・`onSelectFacility`/`onBack` 配線）、`src/App.test.tsx`、`src/styles.css`（`.map-shell`・`.map-canvas`・`.map-toggle`・凡例・divIcon ピンのクラス）

**変更不要**: `filterFacilities.ts`、各ストア、`firestore.rules`

## 実装順序（コミット単位）

1. 依存追加（package.json/lock のみ・挙動変更なし） → `npm run lint`・`npm run test` green
2. `src/mapPins.ts` ＋ テスト（Leaflet 非依存の純関数のみ） → `npm run test`
3. `src/MapPanel.tsx` ＋ CSS ＋ テスト（Leaflet/markercluster を `vi.mock`） → `npm run test` ＋ `npm run dev` 目視
4. App.tsx への配線（mapOpen・ボタン・遷移） ＋ App.test.tsx → `npm run test` ＋ 通し目視

## テスト計画（要点）

- **純関数**（mapPins.test.ts）: `pinAppearance` の表示モデル（訪問×マークの全組み合わせで本体色・バッジの真理値表）を検証。凡例データの整合（4項目分・色とラベルの対応）
- **コンポーネント**（MapPanel.test.tsx）: `vi.mock("leaflet")`/`vi.mock("leaflet.markercluster")` でダミー化し、ヘッダー・凡例ラベル・件数表示・空状態メッセージ・`onBack` 呼び出しを検証。ポップアップのクリック配線は内部関数を export して単体検証
- **App**（App.test.tsx）: 地図ボタンで画面切替・`shown` が渡ることのスモーク
- **実描画（タイル・クラスタ・ピン色）は jsdom で検証不能** → `npm run dev` 目視を完了条件に含める（plan.md の「目視（ピン色分け・クラスタ動作）」と整合）

## 検証（完了の定義）

1. `npm run test`・`npm run lint`・`npm run build` 全パス
2. `npm run dev` で通し目視: 一覧で絞り込み → 「地図で見る」 → 絞り込み結果だけがピン表示・本体色とバッジが凡例どおり・クラスタが展開する → ピンのポップアップ → 「詳細を見る」で VisitPanel へ → 戻る → **再度地図を開く（StrictMode の開閉繰り返しで「Map container is already initialized」が出ないこと）** → 地図表示中に別端末相当の marks 更新（開発中はトグル操作で代用）でピンが更新され**中心・ズームが維持される**こと。0件・1件・同一座標複数施設のケースも確認。スマホ幅でのタッチ操作（ドラッグ・ピンチ）と帰属表示が隠れないことを確認
3. 本番ビルド（`npm run build` → preview）で**タイル・ピンが正しく表示される**こと（Vite の base パス・アセット問題の最終確認）
4. OSM 帰属表示が地図上に見えていること

## リスク・注意点

1. **leaflet.markercluster が2021年から未更新** — Leaflet 1.9.x との動作実績は豊富で許容。Leaflet 2.0 移行時の再検証を申し送り
2. **jsdom で実描画を検証できない** — 目視確認を完了条件に含める（自動テストのみでの完了判定は不可）
3. **working tree の未コミット変更との競合** — 実装着手時に最新 main を pull し、その時点の App.tsx 構造（「その他の操作」パネル化等）に合わせて配線
4. **手動追加施設の県庁所在地近似座標** — 同一県の custom 施設が地図上で同一点に密集して見える可能性（既存挙動由来・ステップ8の修正対象外。ステップ7プランの申し送りと同じ将来課題）
5. 色のみでの状態区別は色覚多様性の観点で不完全 — 凡例のテキストラベル必須化で最低限を担保。リング/サイズでの二重化は将来改善

## モデル采配（規律7）

| 作業 | 担当 |
|---|---|
| 設計・プラン（本作業） | Fable（メイン） |
| 実装1〜4（方針決定済みの実装・テスト） | Sonnet サブエージェント（deep-code 経由） |
| テスト実行・差分確認 | メインで直接（軽作業） |
| 最終レビュー・通し目視 | Fable（メイン）＋ユーザー実機確認 |

変更は6ファイル超のため実装時は **deep-code** を呼ぶ。

## Codex レビュー

2026-07-15 に codex-skill（gpt-5.6-luna, reasoning effort: high）でレビュー実施。「方向性は妥当（plain Leaflet + markercluster + divIcon は React 19/Vite 7 で十分実装可能）。ただし実装開始前に6点の追記が必要」との評価。Codex はリポジトリ実コード（main.tsx の StrictMode・App.tsx の購読初期値・VisitPanel のマーク仕様・index.html の Referrer-Policy 不在）と公式資料（React/Leaflet/OSM Tile Usage Policy/markercluster README）を確認して裁定。

**反映した指摘**:
- **StrictMode 対応が必須**（main.tsx が StrictMode で包まれていることを実コードで確認）→ 初期化 Effect と マーカー更新 Effect の分離、cleanup での `map.remove()`＋ref クリア、依存配列に shown/marks を入れない、を設計に明文化
- **snapshot 更新で map を作り直さない** → クラスタグループのみ clear/rebuild、中心・ズーム・ポップアップを維持、`fitBounds` は初回のみ
- **visits/marks 未取得時に全ピンが未訪問表示になる**（購読前の初期値が空集合であることを実コードで確認）→ 「地図で見る」ボタンをデータ受信完了まで disabled
- **単色4分類はピンの訪問状態とマーク状態という別軸を潰す**（VisitPanel はマークを訪問状態と無関係に併用可能）→ **二軸分離に設計変更**: ピン本体色=訪問済み/未訪問、favorite/wishlist=ミニバッジ。クラスタは中立色＋件数のみ、`disableClusteringAtZoom` 指定
- **ポップアップの XSS**（手動追加施設名はユーザー入力）→ HTML 文字列埋め込み禁止、`createElement`＋`textContent` で生成
- **MarkerCluster.css / MarkerCluster.Default.css の import 漏れ** → 明記
- **iOS の invalidateSize 対応** → 初期化直後＋`resize`/`visualViewport.resize` で呼ぶ
- **OSM ポリシーの付帯条件**（Referer・ブラウザキャッシュ・precache 禁止）→ 確認項目に追加（index.html に restrictive な Referrer-Policy がないことは確認済み）
- 検証手順に「開閉繰り返し・snapshot 更新時の中心維持・0件/1件/同一座標・帰属表示」を追加

**見送った指摘と理由**:
- **施設IDによるマーカーの差分更新**: Codex 自身も「300〜500件なら clear/rebuild で実用上十分」と評価。差分管理のコード複雑化に見合わない。将来マスタが数千件級になったら再検討
- **凡例のリング/サイズによる更なる差別化**: 二軸分離＋テキストラベル必須で色覚多様性への最低限の担保はできており、バッジ形状（★/♡）自体が色以外の識別子を兼ねる。過剰装飾は見送り
