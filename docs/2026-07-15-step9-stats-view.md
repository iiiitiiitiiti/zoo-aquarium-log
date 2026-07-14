# zoo-aquarium-log ステップ9: 統計画面

## Context

`docs/plan.md` の実装ステップ9。合意済みの実装順（6→10→7→8→9→11）で、6・10 は実装済み、7 は Gate 1 でユーザー判断により中断中、8 はプラン承認済み（未実装）。plan.md の要件: 「全体制覇率、都道府県別 x/y 館、種別別、訪問数の推移」。統計は Firestore に保存せず visits からクライアント側で派生計算する（集計カウンター文書を持たない）が確定方針。

前提（2026-07-15 にコード実地確認済み）:

- App.tsx（410行）はルーターなしの state 分岐（facilityEditorOpen → AddFacilityPanel / selectedFacility → VisitPanel / 他 → 一覧）。visits・marks・customFacilities を購読済みで、`allFacilities`（静的150件＋手動追加）・`visitedIds`（Set）を useMemo で派生済み
- `Visit.date` は `"YYYY-MM-DD"` 文字列。`rating?: number`。visitor / memo / photoPath はオプション
- `Facility.status`: `"open" | "closed" | "suspended"`。`src/prefectures.ts` に47都道府県（name・capital・lat/lng）の正準リストあり
- 依存は firebase / react / react-dom のみ（チャートライブラリなし）。styles.css は CSS カスタムプロパティなし・ハードコード色（背景 #102e28、ヒーロー #173f35、クリーム #f7f4e8、アクセント #2a7180、緑 #2f6b50）
- ステップ8実装後は App に `mapOpen` 分岐が加わる予定。本ステップは同じパターンで `statsOpen` を追加する（**8 のマージ後に着手** — App.tsx の競合回避）

このプランの正本はリポジトリ内 `docs/2026-07-15-step9-stats-view.md` に置く。

## 設計要点

### 1. 集計モデル（新規 `src/stats.ts`・純関数）

`buildStats(facilities: Facility[], visits: Visit[], now?: Date): StatsModel`。facilities には `allFacilities`（マスタ＋手動追加）を渡す。`now` 注入は buildExport と同じテスト容易性のための流儀。

集計の定義（エッジケースを先に確定させる）:

- **分母（対象施設）**: `status !== "closed"`。plan.md の「閉園は制覇率の分母から除外」に従う。suspended（休園）は現存施設なので分母に**含める**
- **訪問済み（分子）**: visits の facilityId ユニーク集合と分母施設の**積集合**。閉園後も訪問記録自体は残るが、分子・分母の両方から除外することで率が 100% を超えない定義にする
- **同一施設への複数回訪問**: 制覇率では1館、推移では記録数どおりカウント
- **削除済み手動施設への訪問記録**（dangling facilityId）: 推移には数える（記録は実在）・制覇率の分子には数えない（積集合から自然に外れる）
- **手動追加施設**: 分母・分子とも通常施設と同等に扱う（重複収録の可能性は既知の許容事項）

StatsModel の内訳:

| 項目 | 内容 |
|---|---|
| overall | `{ visited, total, percent }`。percent は **Math.floor**（100% は全館訪問時のみ表示される）。**total === 0 のとき percent は 0**（ゼロ除算の明示定義） |
| byType | zoo / aquarium / both / other ごとの `{ visited, total }`（**分母は overall と同じく closed 除外**）。表示ラベルは 動物園 / 水族館 / 動物園・水族館 / その他。total 0 の種別行は省略 |
| byPref | `prefectures.ts` の47都道府県順を正準とし、**分母（closed 除外後）が1件以上の県のみ**の `{ pref, visited, total }`。閉園施設しかない県は表示しない（0/0 行を作らない）。手動追加施設の pref が47県名に一致しない場合は末尾に「その他」行（同じく分母0なら省略） |
| monthly | 訪問**記録件数**を `date.slice(0, 7)`（"YYYY-MM"）でグループし、**最古の訪問月〜終点まで0埋め**した配列。終点は `max(now の月, 最新訪問月)` — 未来日付の記録（入力フォームに max 制約がなく作成可能）が範囲から漏れて「エクスポート件数と月別合計の一致」が崩れるのを防ぐ。visits 0件なら空配列 |

### 2. 画面（新規 `src/StatsPanel.tsx`）

- 既存の全画面切替パターンを踏襲。ヘッダーに「← 施設一覧」戻るボタン（`back-button` 流用）
- セクション構成: ①サマリー（大きな % と x/y 館）→ ②種別別（4行・横バー＋数値）→ ③都道府県別（横バー＋ x/y 数値の縦リスト）→ ④月別推移（縦バー・横スクロール・月ラベル）
- **チャートライブラリは追加しない**。横バー＝div の width%、縦バー＝div の height% の CSS バーで実装し、**数値を必ず併記**する（色のみに依存しない）。新規依存ゼロ
- アクセシビリティ: バーは装飾（`aria-hidden`）とし、**読み上げ対象は併記した数値テキスト**（`x / y 館` 等）に持たせる。月別推移には「横にスクロールできます」の案内テキストを添える
- 統計は**検索フィルタと無関係に全施設・全記録**を対象とする（画面冒頭に「すべての施設・記録が対象」と明記して誤解を防ぐ）
- **データ未受信時の誤表示防止**: 統計ボタンは visits と customFacilities の初回スナップショット受信まで disabled（既存の exportNotReady と同じ条件パターン）。marks は統計に不使用なので条件に含めない

### 3. エントリポイント（実装開始時にユーザー確認）

推奨: 一覧見出し行（`.results-heading`）にステップ8の「地図で見る」と並べて「統計」常設ボタン。統計は plan.md の5画面の1つ（主要画面）であり、「その他の操作」（低頻度操作置き場）には入れない。

※ステップ8のエントリポイントはユーザー自身が決定した経緯があるため、位置は仮置きとして実装開始時に確認する。

## 変更ファイル一覧

**新規**: `src/stats.ts`（＋`src/stats.test.ts`）、`src/StatsPanel.tsx`（＋`src/StatsPanel.test.tsx`）

**変更**: `src/App.tsx`（`statsOpen` state・分岐・ボタン・disabled 条件）、`src/App.test.tsx`、`src/styles.css`（`.stats-*` クラス群）

**変更不要**: `filterFacilities.ts`、各ストア、`firestore.rules`、`facilities.json`

## 実装順序（コミット単位）

1. `src/stats.ts` ＋ テスト（純関数のみ・UI なし） → `npm run test` green
2. `src/StatsPanel.tsx` ＋ CSS ＋ テスト → `npm run test` ＋ `npm run dev` 目視
3. App.tsx への配線（statsOpen・ボタン・disabled） ＋ App.test.tsx → `npm run test` ＋ 通し目視

## テスト計画（要点）

- **stats.test.ts**: 閉園除外・suspended 包含・訪問のユニーク化・dangling facilityId・月別0埋め（**年跨ぎを含む**）・**未来日付（終点 = max(now, 最新訪問月)）**・floor 丸め（99.9%→99）・visits 0件・**total 0（percent 0・行省略）**・**閉園施設しかない県の非表示**・未知 pref の「その他」行、の真理表
- **StatsPanel.test.tsx**: fixture を渡して各セクションの数値表示・空状態メッセージ・`onBack` 呼び出しを検証
- **App.test.tsx**: 統計ボタンで画面切替・データ未受信時 disabled のスモーク

## 検証（完了の定義）

1. `npm run test`・`npm run lint`・`npm run build` 全パス
2. plan.md の完了確認「既知データと数値照合」を実データで実施:
   - 一覧の「訪問済み」フィルタ件数と統計の訪問済み館数が一致する
   - エクスポート JSON の `counts.visits` と月別推移の合計が一致する
   - 手計算 fixture との照合はユニットテストで担保済み
3. `npm run dev` 目視: スマホ幅（480px）でバーが崩れない・推移の横スクロールが動く・visits 0件相当の空状態表示

## リスク・注意点

1. **月別推移の横長化**: 記録期間が伸びると棒の本数が増える → 横スクロールで許容。36ヶ月を超えたら年別集計への切替を検討（現時点では YAGNI）
2. **手動追加施設による分母の膨張**: マスタとの重複収録がありうる（既知の許容事項。plan.md の方針どおり自動統合しない）
3. **ステップ8との App.tsx 競合**: 8 のマージ後に着手する（合意順どおり）。着手時に最新 main の App.tsx 構造（mapOpen 分岐・見出し行ボタン）に合わせて配線
4. **タイムゾーン**: date は素朴な "YYYY-MM-DD" 文字列で、月グループは文字列 slice のみ（Date パース不使用）。now 由来の「今月」だけ端末ローカル時刻に依存するが、家族利用（JST）では問題にならない

## モデル采配（規律7）

| 作業 | 担当 |
|---|---|
| 設計・プラン（本作業） | Fable（メイン） |
| 実装1〜3（方針決定済みの実装・テスト） | Sonnet サブエージェント（deep-code 経由） |
| テスト実行・差分確認 | メインで直接（軽作業) |
| 最終レビュー・実データ照合 | Fable（メイン） |

変更は7ファイルのため実装時は **deep-code** を呼ぶ。

## 未確定事項（実装開始時に決める）

- エントリポイントの位置（推奨: 見出し行に「地図で見る」と並置）
- 月別推移の表示範囲（推奨: 全期間0埋め＋横スクロール）

## Codex レビュー

2026-07-15 に codex-skill（gpt-5.6-luna, reasoning effort: xhigh）でレビュー実施。「定義を数点補強すれば実装開始可能（条件付き承認）」との評価。Codex はリポジトリ実コード（VisitPanel の日付入力・package.json のテスト経路）と plan.md を確認して裁定。

**反映した指摘**:
- **`total === 0` の定義漏れ** → percent は 0 と明示（ゼロ除算の明示定義）
- **未来日付の記録に弱い**（訪問フォームに max 制約がなく未来日付を作成可能。「最古月〜now」だと未来月の記録が月別表示から漏れ、エクスポート件数との照合が崩れる） → 月範囲の終点を `max(now の月, 最新訪問月)` に変更し、テスト計画に未来日付ケースを追加
- **都道府県別・種別別の分母定義が overall にしか書かれていない** → 全区分で closed 除外を明記。閉園施設しかない県（0/0 行）は非表示と決定
- **バーのアクセシビリティ** → バーは `aria-hidden` の装飾とし読み上げは数値テキストに持たせる方針、横スクロール案内テキストを追記

**見送った指摘と理由**:
- **36ヶ月超での「直近36ヶ月＋全期間」切替**: 既にリスク欄で将来課題として記載済み。現時点の記録量では YAGNI（Codex も現案の全期間横スクロールで可と評価）
