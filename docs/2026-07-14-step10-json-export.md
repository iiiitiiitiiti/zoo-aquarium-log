# zoo-aquarium-log ステップ10: JSONエクスポート

## Context

`docs/plan.md` の実装ステップ10。合意済みの実装順（6→10→7→8→9→11）に基づく次ステップ。plan.md では「家族の長期記録のバックアップ手段として早期に実装」と明記されている。

前提（コード実地確認済み・コミット `9e3dbb1` 時点）:
- ステップ6により `App.tsx` は世帯の全データをメモリ上に保持済み — `visits: Visit[] | undefined`（`subscribeAll` 全件購読）、`marks: MarkMap | undefined`、`customFacilities: Facility[]`。**エクスポートは追加の Firestore 読み取りゼロ**でこの state から派生生成できる
- firestore.rules 変更なし（読み取り専用機能）。ルーター・新規画面・新規依存パッケージなし
- UI 配置はユーザー決定済み（2026-07-14）: **一覧画面に直接ボタン**（設定画面は作らない。将来合言葉変更が必要になった時点で設定画面を新設し移設）

このプランの正本はリポジトリ内 `docs/2026-07-14-step10-json-export.md` に置く（承認後に格納）。

## 設計要点

### 1. エクスポートJSONスキーマ（新規 `src/buildExport.ts`）

`filterFacilities.ts` と同じ「型＋主要関数を1ファイル」の流儀。

```ts
export const EXPORT_SCHEMA_VERSION = 1 as const;

export interface ExportVisit {
  id: string;
  facilityId: string;
  date: string;
  rating?: number;
  memo?: string;
  visitor?: string;
  photoPath?: string;   // 文字列のみ。Storage の写真実体は含まれない
  createdAt: string | null;  // ISO 8601（Timestamp.toDate().toISOString()）。serverTimestamp 未解決時は null
  updatedAt: string | null;
}

export interface ExportMark { facilityId: string; wishlist: boolean; favorite: boolean }

export interface ExportData {
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  counts: { visits: number; marks: number; customFacilities: number };
  visits: ExportVisit[];
  marks: ExportMark[];
  customFacilities: Facility[];  // facilities.json と同スキーマ
}
```

- **Timestamp は ISO 8601 文字列へ変換**（生の `{seconds, nanoseconds}` はJSON閲覧・将来のインポートで扱いにくい）。**null ガード必須**: `serverTimestamp()` 作成直後・オフライン時はローカルスナップショットで null になりうる（型は Timestamp でも実行時 null）。例外を投げず **`null` を出力**する（スキーマ型は `string | null`。空文字列は ISO 8601 として不正で「欠損」と区別できないため不採用 — Codex 指摘で変更）
- **marks は MarkMap でなく配列**（`{facilityId, wishlist, favorite}[]`）。キー順非保証の回避と、将来のインポート処理（1件ずつ復元）との対称性
- **Firestore ドキュメント `id` を保持** — 将来のインポートで同じ id へ setDoc すれば既存の冪等 create（visits の runTransaction）とそのまま整合し重複防止できる。インポート自体は今回スコープ外
- **静的マスタ150件は含めない**（リポジトリ管理でバックアップ不要）
- **孤児 visits（削除済み custom 施設への訪問記録）もそのまま全件含める** — バックアップは現在の施設一覧でフィルタしてはならない（フィルタすると記録が消失する）。ステップ6からの申し送り事項への対応
- `schemaVersion`/`counts` は将来の v2 互換判定・インポート前チェック用

### 2. 純関数化と決定論的出力

```ts
export function buildExport(visits: Visit[], marks: MarkMap, customFacilities: Facility[], now?: Date): ExportData
export function buildExportFilename(now?: Date): string  // zoo-aquarium-log-YYYY-MM-DD.json
```

- ソートは **buildExport 内部で必ず実施**（visits: date昇順→id昇順、marks: facilityId昇順、customFacilities: id昇順）。`subscribeAll`/`subscribe` は orderBy を持たずスナップショット順は非保証のため、呼び出し側の順序を信用しない。同じデータなら同じ出力（`exportedAt` の1行を除く）となり diff 比較可能
- optional フィールドは素直に代入（`JSON.stringify` が undefined キーを自動除外。tsconfig の `exactOptionalPropertyTypes` は無効を確認済み）
- Timestamp は `{ toDate(): Date }` の最小インターフェースで受ける（テストで実 `Timestamp.fromDate` をアプリ初期化なしで渡せる）
- ファイル名の日付は **ローカル日付**（`VisitPanel.tsx` の `today()` と同じ生成方法。JST ユーザーの直感に合わせ、既存流儀にも一致）

### 3. ダウンロードUI（`src/App.tsx` へ最小配線、新規コンポーネントなし）

- **配置**: `.results` セクション内、一覧の三項分岐（0件 empty / リスト）の**外側**に常時表示。「掲載されていない施設を追加」（`.add-facility-link`）の近くだが、**検索で0件になってもバックアップ手段が消えない**ことを保証する配置（分岐内に置くと地味だが致命的な回帰になる）
- **customFacilities の loading/error 管理を追加**（Codex 指摘で変更。現状 App.tsx:74 は初期値 `[]`・購読エラー握りつぶしのため、初回スナップショット前にエクスポートすると**手動追加施設が欠けたバックアップが正常成功として生成される**）:
  - `customFacilities` state を `Facility[] | undefined` に変更（購読開始時 undefined → 初回成功で配列）。`customFacilitiesError` state を追加
  - 既存の利用箇所（`allFacilities`・prefectures 派生）は `customFacilities ?? []` で吸収（一覧表示は従来どおりブロックしない）
- **disabled は専用条件 `exportNotReady`**（`statusFiltersLoading` の再利用をやめる）: visits / marks / customFacilities（ストアがある場合）のいずれかが初回スナップショット前、**またはいずれかの購読エラーあり**の間は押せない。エラー状態での不完全バックアップの黙認を防ぐ
- **ストア未提供時**: 出し分けしない（ストアが無い場合 state は即 `[]`/`{}` になり空バックアップが出るだけ。実運用では常に全ストアあり）
- **実装**: Blob + `URL.createObjectURL` + `<a download>` を動的生成して `document.body` に追加し、同一クリックイベント内で `.click()`（ユーザー操作起因のダウンロードとして最も互換性が高い）。**`revokeObjectURL` は `setTimeout(…, 0)` で遅延**（ダウンロード開始前の失効を避ける — Codex 指摘で変更）。`typeof URL.createObjectURL === "function"` 非対応時はボタン disabled（`VisitPanel.tsx` のガードパターン踏襲）
- **写真の明示**: ボタン直下に既存 `.location-note` クラス（存在確認済み）で「写真データは含まれません。訪問日・メモ・評価・行きたい/お気に入り・手動追加した施設情報が対象です。」（`photoPath` は参照文字列として JSON に保持される）
- **完全バックアップではない旨の明記**: このJSONは「Firestore 上の世帯データのバックアップ」であり、静的施設マスタ（リポジトリ管理）に依存する。単独で施設名までは復元できない制約を README（またはプラン文書）に明記する（Codex 指摘で追加）
- **iOS PWA 申し送り**: ホーム画面追加後のスタンドアロンモードでは blob URL ダウンロードが機能しないことがある既知の挙動。今回は実装のみとし、**ステップ11（PWA化）の実機QAチェック項目に「スタンドアロンモードでのエクスポート動作確認」を追加**する

## 変更ファイル一覧

**新規**: `src/buildExport.ts`、`src/buildExport.test.ts`

**変更**: `src/App.tsx`（`customFacilities` の undefined 初期化＋`customFacilitiesError` 追加、`exportNotReady` 算出、`downloadExport` ハンドラ、ボタン＋説明文）、`src/App.test.tsx`（テスト追記）、`src/styles.css`（原則変更不要。目視で間隔調整が必要な場合のみ1行）、`README.md`（バックアップの範囲＝静的マスタ非包含の注記1〜2行）

**変更不要**: `firestore.rules`、各ストア（visits.ts / marks.ts / customFacilities.ts）、`vitest.rules.config.ts`（emulator テスト追加なし）

## 実装順序（コミット単位）

1. `src/buildExport.ts` + `src/buildExport.test.ts`（UI 非依存の純関数のみ） → `npm run test`
2. `src/App.tsx` ボタン・ハンドラ・説明文 + `App.test.tsx` 追記 → `npm run test`
3. `npm run dev` で目視: クリック→DLされた JSON を実際に開き、schemaVersion・counts・ISO日時・孤児 visits を人手確認（plan.md ステップ10 の完了確認「出力ファイルの内容確認」に対応）

## テスト計画（要点）

- **純関数**（`buildExport.test.ts`）: 実 `Timestamp.fromDate` フィクスチャからの組み立て（schemaVersion・counts・ISO変換）／optional 省略時に JSON へキーが出ない／**入力順を変えても出力が同一**（決定論性）／**入力配列を破壊しない**（ソートはコピーに対して行う）／空入力／**createdAt が null でも null として有効な JSON になる**／孤児 visits・marks がフィルタされない／ファイル名形式
- **コンポーネント**（`App.test.tsx`）: `vi.stubGlobal` で `URL.createObjectURL`/`revokeObjectURL` をスタブ＋ `HTMLAnchorElement.prototype.click` スタブ（jsdom のナビゲーション防止）。クリックで Blob の中身（`await blob.text()` → parse）に visits/marks/customFacilities と**日本語文字列（UTF-8）**が正しく反映される／revoke が（遅延後に）呼ばれる／**visits・marks・customFacilities いずれかの初回スナップショット前は disabled → 全て到着後 enabled**／**購読エラー時は disabled**／**検索0件状態でもボタンが表示され続ける**（配置判断の回帰防止）

## 検証（完了の定義）

1. `npm run test` 全パス（`npm run test:rules` は対象外 — rules 変更なし）
2. `npm run dev` で通し目視: 記録がある状態でエクスポート → JSON の中身確認。スマホ幅レイアウト確認
3. 可能ならスマホ実機の Safari 通常タブで1回確認（スタンドアロンモードはステップ11へ申し送り）

## リスク・注意点

1. `serverTimestamp()` 未解決（null）への防御を忘れると、記録作成直後のエクスポートがクラッシュする
2. ボタンを三項分岐の外に置くこと（0件時にバックアップ手段が消える回帰の防止）
3. buildExport 内での明示ソート（スナップショット順を信用しない）＋入力配列の非破壊
4. `customFacilities` を `Facility[] | undefined` に変える際、既存の `allFacilities`・prefectures 派生と一覧表示を `?? []` で壊さないこと
5. iOS スタンドアロン PWA の download 挙動はステップ11実機QAへ申し送り。`<a download>` はブラウザがダウンロードを保証する属性ではない点も同QAで確認
6. `JSON.stringify(…, null, 2)` は数千件規模なら問題なし（家族数人・長期運用の想定内）。数万件級になったら実機でメモリ確認（現実的には到達しない見込み）

## モデル采配（規律7）

| 作業 | 担当 |
|---|---|
| 設計・プラン（本作業） | Fable（メイン） |
| 実装1〜2（方針決定済みの実装・テスト） | Sonnet サブエージェント |
| テスト実行・差分確認 | メインで直接（軽作業） |
| 最終レビュー・通し検証 | Fable（メイン） |

変更は実質5ファイル・100〜150行の見込み。deep-code の閾値（3ファイル以上）に該当するため実装時は deep-code を呼ぶ。

## Codex レビュー

2026-07-14 に codex-skill（gpt-5.6-luna, reasoning effort: high）でレビュー実施。「条件付きで妥当。実装前に4点を仕様化せよ」との評価。

**反映した指摘**:
- **customFacilities の loading/error 未管理**（最重要）: 現状 App.tsx:74 は初期値 `[]`・購読エラー握りつぶしのため、初回スナップショット前のエクスポートで手動追加施設が欠けたバックアップが「正常成功」として生成される → state を `Facility[] | undefined` 化＋`customFacilitiesError` 追加＋エクスポート専用の `exportNotReady` 条件（3データ全ての初回受信完了かつエラーなし）に変更。App.tsx:74 の現状は当方でも実コードで確認済み
- Timestamp 欠損の空文字列出力は ISO 8601 として不正で「欠損」と区別できない → `string | null` として null 出力に変更
- 静的マスタ非包含により「単独で施設名まで復元できるバックアップ」ではない → README へ制約を明記する作業を追加
- `revokeObjectURL` の即時実行はダウンロード開始前の失効リスク → `setTimeout(…, 0)` 遅延に変更。`createObjectURL` 非対応時は silent return でなくボタン disabled に
- テスト追加: 入力配列の非破壊、日本語（UTF-8）の Blob 内容検証、購読未完了・購読エラー時の disabled

**見送った指摘と理由**:
- `counts` への孤児件数（orphanVisits/orphanMarks）追加: 孤児判定は静的マスタとの突合で導出される診断情報であり、マスタ更新で事後的に変わる。バックアップには生データのみを含め、孤児検出は将来のインポート／統計（ステップ9）側の責務とする。counts はファイル内に実在する件数のみ
- JSON 内への `staticFacilityCatalog: "external"` 等のメタ追加: README 注記と schemaVersion のドキュメントで足りる。スキーマの追加フィールドはインポート実装時に必要性を再判断
- iOS 向け「新規タブで開いて共有・保存」フォールバック: ステップ11（PWA化）の実機QAで挙動を見てから判断（プランに申し送り済み）
- `photoPath` の扱いが未決定という指摘: プラン当初から「参照文字列として含める」と決定済み（レビュー依頼文には記載していたため認識ずれ。結論は Codex 推奨と同一）
