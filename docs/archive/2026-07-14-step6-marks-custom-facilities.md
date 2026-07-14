# zoo-aquarium-log ステップ6: 行きたい/お気に入り/訪問状態フィルタ＋手動施設追加

## Context

`docs/plan.md` の実装ステップ6。訪問記録CRUD(ステップ5)までは完了・公開済みで、次は「行きたいリスト」「お気に入り」のトグルと施設一覧のフィルタ、施設の手動追加を実装する。

調査で確認済みの重要な前提: **firestore.rules と負例テストは既に `marks` / `customFacilities` に対応済み**（`firestore.rules:114-125`、`tests/firestore.rules.test.ts`）。ルール変更は不要で、残作業はフロントエンドのストア層＋UIのみ。

- `marks/{facilityId}`: `{wishlist: bool, favorite: bool}` の2キー必須（hasAll/hasOnly）
- `customFacilities/{facilityId}`: Facility全フィールド必須、`id` は `^custom_[a-zA-Z0-9_-]+$` かつ docId 一致、`sourceUrls` 1〜10件必須、`lat`/`lng` は number 必須

## 設計要点

### 1. MarkStore（新規 `src/marks.ts`）

`src/visits.ts` の `VisitStore`/`FirestoreVisitStore` と対称のパターン。

- `MarkMap = Record<string, Mark>`（key = facilityId。custom_ 施設も同じ空間）
- `subscribe(onMarks, onError)`: 世帯の marks **全件**を1つの onSnapshot で購読（一覧フィルタが全施設分を必要とするため）
- 書き込みは **`setFlag(facilityId, flag: "wishlist" | "favorite", value: boolean)`**: `runTransaction` で現在値を読み、対象フラグだけ変更した完全な `Mark` を組み立てて set。両方 false になったら同一トランザクション内で delete（「ドキュメント無し = 両方false」で解釈が一貫）。visits.create の runTransaction 冪等化と同じ流儀。
  - 完全な Mark を丸ごと setDoc する方式は、2端末が別々のフラグを同時操作したとき片方の変更が消えるため不採用（Codex 指摘で変更）
- 配線: `main.tsx` で生成 → `App` が1回購読して `marks` state に保持 → `VisitPanel` へ `mark`（該当施設分）と `markStore` を渡す
- VisitPanel ヘッダーに「♡ 行きたい」「★ お気に入り」トグル（`aria-pressed`）。marks 用のエラー state は訪問記録用 `error` と分離

### 2. 訪問状態フィルタ（visited/unvisited/wishlist/favorite）

- `VisitStore` の施設単位 `subscribe(facilityId, ...)` を **`subscribeAll(onVisits, onError)` に置き換える**（where句なしの全件購読）。App が1回購読し、`VisitPanel` へは該当施設分に絞った `visits` を **props で渡す**（VisitPanel 内の購読 useEffect は廃止）
  - 全件購読と施設別購読の二重リスナーは同一ドキュメントの読み取りが重複課金されるため排他にする（Codex 指摘で変更）。一覧フィルタに全件が必要な以上、全件購読へ一本化するのが最小
  - `Visit[]` 全件を返すのはステップ9（統計画面、クライアント派生計算方針）で同じ購読を再利用する前提
- App 側で `visitedIds = new Set(visits.map(v => v.facilityId))` を useMemo で派生
- `filterFacilities`（`src/filterFacilities.ts`）は**既存5引数を変えず**、6番目にデフォルト値付きオプションオブジェクトを追加:
  ```ts
  export type VisitStatusFilter = "all" | "visited" | "unvisited" | "wishlist" | "favorite";
  export interface VisitStatusQuery { filter: VisitStatusFilter; visitedIds: ReadonlySet<string>; marks: MarkMap; }
  ```
  既存の全呼び出し・全テストは無変更で通る（Codex も暫定採用可と評価）
- App.tsx に「訪問状況」フィルタグループ（既存 `.filters`/`.filter-group` 流用、すべて/訪問済み/未訪問/行きたい/お気に入りの5ボタン・**単一選択**。訪問状態×marks の組み合わせ絞り込みは仕様外と明記）。`activeFilterCount`・`resetFilters` にも組み込む
- **ローディング中の誤表示防止**: visits / marks の初回スナップショット受信前は「すべて」以外の4ボタンを disabled にする（空集合での誤った0件表示を防ぐ。Codex 指摘で追加）

### 3. 手動施設追加

- 新規画面 `src/AddFacilityPanel.tsx`。App.tsx の `selectedFacility` と同じ state 切替パターン（ルーター導入なし）
- **追加と編集の兼用フォーム**とする: `initialFacility?: Facility` prop があれば編集モード（同じ id へ setDoc。rules の update は全フィールド検証で許可済み）。編集なしだと入力ミスの修正手段が「削除→再登録」しかなく孤児データを増やすため、YAGNI 見送りを撤回（Codex 指摘で変更。フォーム流用のため追加コストは小さい）
- 導線: (1) 検索0件の `.empty` ブロックに CTA「この施設を手動で追加」、(2) 一覧末尾に「掲載されていない施設を追加」、(3) custom 施設の VisitPanel ヘッダーに「編集」。いずれも `customFacilityStore` prop がある場合のみ表示（`onSignOut` と同じ feature-detection）
- 保存成功後は `onCreated(facility)` でそのまま VisitPanel へ遷移（追加の主目的は「今すぐ記録したい」）
- 新規 `src/customFacilities.ts`: `CustomFacilityStore`（create / update / remove / subscribe）。**`newId()` は `"custom_" + doc(collection).id`**（Firestore 自動IDに接頭辞。`crypto.randomUUID` ではなく既存 `VisitStore.newId()` と同じ流儀・secure context 依存もなくなる。Codex 指摘で変更）
- custom 施設の削除: VisitPanel ヘッダーに `id.startsWith("custom_")` のときだけ「この施設を削除」（confirm → `onBack()`）。紐づく visits/marks は孤児として残す（誤削除時に記録を失わない利点を採り、クリーンアップは見送り。確認ダイアログの文言で注意喚起）
- 入力項目とルール整合:

  | 項目 | 入力方法 |
  |---|---|
  | name | 必須テキスト（≤200） |
  | kana / city / url | 任意テキスト |
  | pref | 必須セレクト（47都道府県固定リスト。新規 `src/prefectures.ts`） |
  | type | セレクト（既存 `typeLabels` 流用、既定 zoo） |
  | status | **セレクト（営業中/休園中/閉園済み、既定は営業中）**。閉園済み施設の過去訪問を登録するケースを許容し、営業状態フィルタの誤表示を防ぐ（Codex 指摘で open 固定から変更。rules は3値とも許可済み） |
  | lastVerifiedAt | 自動で今日の日付（YYYY-MM-DD）。**意味は「登録日」**であり master の「一次情報確認日」とは異なる転用と明記（世帯自己責任データのため許容） |
  | sourceUrls | 画面に出さない。`url` があればそれを1件目に、無ければ Google マップ検索URLを自動生成 |
  | lat/lng | 自動設定＋現在地ボタン（ユーザー確認済み 2026-07-14・下記） |

- **位置情報（ユーザー決定: 自動推定＋現在地ボタン方式）**: 座標入力欄はユーザーに見せない。既定値は **`src/prefectures.ts` に持つ47都道府県の県庁所在地座標テーブル**から引く（実データ確認: facilities.json は46都道府県のみで**佐賀県が0件**。既存施設の平均座標方式は未定義ケースが出るため、常に定義済みの静的テーブルへ変更。Codex 指摘を検証のうえ採用）。`navigator.geolocation` がある環境のみ「現在地を使う」ボタンを任意表示し、成功時のみ上書き。失敗・拒否時は黙って既定値のまま保存継続（**GPS失敗で保存がブロックされる回帰を防ぐテスト必須**）。座標は県庁所在地近似 — ステップ8（地図）着手時に補正手段（ピンのドラッグ等）を再検討（申し送り）
- 一覧への合流: `allFacilities = [...facilities, ...customFacilities]`（静的マスタと自動統合しない既定方針どおり）。都道府県フィルタの選択肢は `allFacilities` 由来に切替。カードに「手動追加」バッジ（`.badges .custom`）
- 訪問記録・marks は facilityId のみ参照なので custom 施設にも追加コードなしで動く

## 変更ファイル一覧

**新規**: `src/marks.ts`、`src/customFacilities.ts`、`src/prefectures.ts`（47都道府県名＋県庁所在地座標。+ `src/prefectures.test.ts`: 47件・重複なし・座標が日本の範囲内）、`src/AddFacilityPanel.tsx`（+ `src/AddFacilityPanel.test.tsx`）、`tests/marks.integration.test.ts`、`tests/customFacilities.integration.test.ts`

**変更**: `src/visits.ts`（`subscribe(facilityId)` → `subscribeAll` へ置換）、`tests/visits.integration.test.ts`（購読テストを subscribeAll に更新）、`src/filterFacilities.ts`（+テスト）、`src/App.tsx`（+テスト）、`src/VisitPanel.tsx`（購読廃止・visits props化、トグル、編集/削除導線。+テスト）、`src/main.tsx`（ストア配線）、`src/styles.css`（`.mark-toggles`・`.badges .custom` 程度、フォームは既存クラス流用）、`vitest.rules.config.ts`（**include はglobでなく明示配列。統合テスト2本の追記を忘れない**）

**変更不要**: `firestore.rules`、`docs/facility-criteria.md`（ID規約記載済み）

## 実装順序（コミット単位）

1. `src/marks.ts`（トランザクション setFlag）＋ 統合テスト ＋ vitest.rules.config.ts 追記 → `npm run test:rules`
2. トグルUI（main.tsx 配線、App の marks 購読、VisitPanel トグル、CSS、テスト） → `npm run test`＋目視
3. visits の `subscribeAll` 化 ＋ VisitPanel への props 渡しリファクタ ＋ 訪問状態フィルタ（ローディング中 disabled 含む） → `npm run test`＋目視
4. `src/customFacilities.ts` ＋ `src/prefectures.ts` ＋ 統合テスト ＋ config 追記 → `npm run test:rules`
5. `AddFacilityPanel`（追加・編集兼用）＋ テスト ＋ 一覧合流・導線・削除・バッジ → `npm run test`＋通し目視

## テスト計画（要点）

- 統合（emulator）: MarkStore の setFlag（新規作成/片方トグル/両方falseでdelete/subscribe 反映）、CustomFacilityStore の create/update/remove/subscribe
- ルールテスト: 既存で網羅済み、追加不要
- 純関数: filterFacilities の visited/unvisited/wishlist/favorite ＋ 他フィルタとのAND ＋ 引数省略の後方互換
- コンポーネント: トグルが setFlag を正しい引数で呼ぶ / 訪問状況フィルタの切替・リセット・**初回スナップショット前は disabled** / AddFacilityPanel の必須検証・sourceUrls フォールバック・県庁所在地既定値・GPS成功時上書き・**GPS失敗でも保存成功**・編集モードで初期値表示＆同一IDへ保存・onCreated 遷移 / custom_ のときだけ編集・削除ボタン
- `navigator.geolocation` は `vi.stubGlobal`（既存 `URL.createObjectURL` スタブと同じ流儀）

## 検証（完了の定義）

1. `npm run test` / `npm run test:rules` 全パス
2. `npm run dev` で通し目視: 施設にトグル → 一覧で「行きたい」フィルタに反映 → 手動追加 → 一覧に「手動追加」バッジ付きで表示 → その施設に訪問記録・トグル → 訪問済みフィルタに反映 → 編集で名称変更が反映 → 削除で消える
3. plan.md ステップ6 の完了確認は「目視」— スマホ幅レイアウトの確認も含める

## リスク・注意点

1. `vitest.rules.config.ts` の include 追記忘れ（テストが静かにスキップされる）
2. `VisitStore` のメソッド置換のため、`App.test.tsx` の visitStore リテラル・`VisitPanel.test.tsx` の FakeVisitStore・`tests/visits.integration.test.ts` を同時更新しないと型エラー
3. subscribeAll の読取コストは家族規模なら Spark 枠内。ステップ9で同じ購読を再利用する旨をコメントで明記
4. 座標は県庁所在地近似 — ステップ8で補正手段を再検討（申し送り）
5. **ステップ9への申し送り**: 統計の訪問済み施設数は `visits` の facilityId と `allFacilities` の**交差集合**で数える（custom 施設削除後の孤児 visits を訪問済みとして数えない）。JSON エクスポート（ステップ10）でも孤児の扱いを明記すること

## モデル采配（規律7）

| 作業 | 担当 |
|---|---|
| 設計・プラン（本作業） | Fable（メイン） |
| 実装ステップ1〜5（方針決定済みの実装・テスト） | Sonnet サブエージェント（deep-code 経由） |
| 各コミット前の差分確認・テスト実行 | メインで直接（軽作業） |
| 最終レビュー・通し検証 | Fable（メイン） |

実装は8ファイル超の変更になるため **deep-code を呼ぶ**（規律6）。

## Codex レビュー

2026-07-14 に codex-skill（gpt-5.6-luna, reasoning effort: high）でレビュー実施。「方向性は妥当だが、実装開始前に潰すべき設計問題あり」との評価。

**反映した指摘**:
- marks の完全上書き setDoc は2端末が別フラグを同時操作すると片方が消える → `runTransaction` で対象フラグのみ更新する `setFlag` API に変更（両方 false なら同一トランザクション内で削除）
- 全件購読（subscribeAll）と施設別購読の二重リスナーは読み取り課金が重複 → VisitPanel の施設別購読を廃止し、App の全件購読から props で渡す方式に一本化
- 佐賀県の施設が facilities.json に0件（46都道府県のみ）で、既存施設の平均座標方式は未定義になる → **実データで検証し事実と確認**。47都道府県の県庁所在地座標の静的テーブル方式へ変更
- status "open" 固定は閉園済み施設の過去訪問登録で誤表示になる → 3値セレクトに変更（rules は許可済み）
- 編集（update）なしだと入力ミス修正が削除→再登録になり孤児データを増やす → YAGNI 見送りを撤回し、追加フォームを編集兼用に
- `crypto.randomUUID()` は secure context 限定 → 既存 `VisitStore.newId()` と同じ Firestore 自動ID＋`custom_` 接頭辞方式へ変更
- visits/marks のローディング中に訪問状況フィルタが誤った空結果を出す → 初回スナップショット前は4ボタンを disabled に
- `lastVerifiedAt` を「今日確認済み」とするのは意味上危険 → 「登録日」としての転用と明記
- 統計（ステップ9）で孤児 visits を訪問済みとして数える危険 → 交差集合で数える仕様を申し送りに明記

**見送った指摘と理由**:
- filterFacilities の全面オブジェクト引数化: Codex 自身も6引数暫定案を許容と評価。既存呼び出し・テスト無変更の利点を優先し、全面移行はフィルタが更に増えた時点で実施
- 平均座標がない都道府県での GPS 必須化: 県庁所在地テーブル方式への変更で未定義ケース自体が消滅したため不要
- custom 削除時に関連 visits/marks も削除する案: 誤削除時に家族の記録を失うリスクの方が重い。孤児許容＋統計側で交差集合、の組で対応
- 訪問状態×行きたい/お気に入りの組み合わせ絞り込み: 単一選択の仕様と明記して見送り（必要になれば multi-select 化）
- kana/city/type の入力欄不明という指摘: レビュー依頼文の要約で省略していたもので、プラン本体には当初から記載済み（誤解）

補足: Codex CLI はサンドボックス内の app-server 初期化に失敗したと自己申告したが、リポジトリの実コード（firestore.rules・filterFacilities.ts・App.tsx・facilities.json）を読んだ上での指摘であり、引用行番号・佐賀県0件の事実も当方で検証済み。
