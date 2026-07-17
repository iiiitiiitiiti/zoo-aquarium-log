# 地図・詳細ページ導線改善 設計書

## Goal

地図と施設詳細の往復を自然にし、施設一覧の2つのアコーディオンの操作感を統一する。

## Current facts

- 画面遷移はルーターではなく `App.tsx` の state 分岐で管理している。
- 地図は `MapPanel` の Leaflet + OpenStreetMap 実装で、一覧の絞り込み結果を `shown` として受け取る。
- 地図上のポップアップから詳細へ移ると、現在は `mapOpen` を閉じて `selectedFacility` だけを設定するため、詳細の戻る操作は常に施設一覧へ戻る。
- 施設には必ず `lat` / `lng` があり、手動追加施設も保存時に座標を持つ。
- 2つのアコーディオンは表示文字が同じ「＋」だが、ボタン本体のフォント指定が異なるため、グリフの太さが一致していない。

## Decisions

### 1. アコーディオンのインジケーターを統一する

`.controls-summary:after` と `.quick-actions-summary:after` に同一のフォント・太さ・サイズ・行高を明示する。見出し本文のサイズや太さは既存デザインを維持し、開閉時の「＋」/「−」だけを共通化する。

### 2. 地図から詳細へ移った経路を保持する

`App.tsx` に詳細画面の入口を `list` / `map` で表す state を追加する。

- 一覧カードから詳細へ移動した場合は `list`
- 地図ポップアップから詳細へ移動した場合は `map`
- `map` 起点の詳細画面では戻るボタンを「← 地図に戻る」とし、一覧の絞り込み状態を保ったまま地図を再表示する
- `list` 起点の詳細画面では既存どおり「← 施設一覧」とする

地図画面は詳細画面表示中に一度アンマウントされるため、地図のズーム・中心は再表示時に通常の初期表示へ戻る。一覧の検索・絞り込み state は `App` に残るため、表示対象施設は維持される。

### 3. 詳細ページからアプリ内地図へ移動する

詳細ページに「地図で場所を見る」ボタンを追加し、外部地図サービスへ切り替えず、現在の Leaflet + OpenStreetMap 画面を開く。`MapPanel` に `focusedFacilityId` を追加し、指定施設が存在する場合はその座標を中心にズーム12で表示し、ポップアップも開く。

詳細ページから地図へ移るときは、その詳細画面を閉じて地図を表示する。地図の戻る操作は既存どおり施設一覧へ戻る。

## Data flow

```text
施設一覧 --地図で見る--> MapPanel(shown)
MapPanel --詳細を見る--> VisitPanel(detailOrigin=map)
VisitPanel --← 地図に戻る--> MapPanel(shown)
施設一覧 --カード--> VisitPanel(detailOrigin=list)
VisitPanel --地図で場所を見る--> MapPanel(shown, focusedFacilityId)
```

## Edge cases

- 絞り込み結果が0件の場合、既存の空状態と日本全域表示を維持する。
- `focusedFacilityId` が表示対象に存在しない場合は、通常の `shown` 初期表示へフォールバックする。
- マークや訪問状況が更新された場合も、既存のマーカー再構築とポップアップ再表示を維持する。
- 施設名などのユーザー入力は引き続き DOM の `textContent` で扱い、HTML文字列へ埋め込まない。

## Verification

- アコーディオン2つのインジケーター CSS が同一スタイルであることをテストする。
- 地図ポップアップから詳細へ移動し、「← 地図に戻る」で地図へ戻れることを `App.test.tsx` で確認する。
- 詳細ページの「地図で場所を見る」で `MapPanel` が対象施設にフォーカスすることを `App.test.tsx` と `MapPanel.test.tsx` で確認する。
- `npm run lint`、`npm test -- --run`、`npm run build`、`git diff --check` を実行する。
