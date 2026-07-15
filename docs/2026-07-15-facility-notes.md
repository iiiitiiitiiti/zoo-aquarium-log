# zoo-aquarium-log 施設メモ機能

作成日: 2026-07-15。施設詳細ページに、訪問記録とは独立した「施設メモ」を追加する実装プラン。

## Context

- 施設ごとの覚え書き（駐車場・持ち物・次回行きたい場所など）を、訪問記録（時系列のイベント記録）とは別に残したいというユーザー要望
- ユーザー裁定済みの仕様（2026-07-15 確定・蒸し返さない）:
  1. **1施設1メモ**（上書き編集のメモ帳型。時系列はやらない）
  2. 配置は**訪問記録セクションの下**（メイン動線を邪魔しない）
  3. **JSONエクスポートに含める**
- 決め打ち（理由付き）:
  - 保存は**保存ボタン方式**（自動保存は世帯共有アカウントでの意図しない上書き・Firestore 書き込み増のリスク）
  - プレーンテキストのみ・**上限2000字**（訪問メモと同一基準）・表示は `white-space:pre-wrap`
  - 同時編集は最終保存勝ち（訪問記録と同じ割り切り。家族運用では許容）

## 設計要点

### 1. データモデル（Firestore）

- パス: `households/{householdUid}/facilityNotes/{facilityId}`（marks と同型のドキュメントID=施設ID方式）
- スキーマ: `{ text: string(1〜2000), updatedAt: timestamp }`。updatedAt は `serverTimestamp()` を使う（クライアント時計を信頼しない。既存 visits と同方式）
- text は**保存時に前後空白を trim してから保存**する（trim 後に空なら削除）。JS の `length` と rules の `size()` は Unicode 境界（絵文字・結合文字）で一致しない場合があるため、上限は保存前チェック＋rules 拒否時のエラー表示の二段構えとし、テストに絵文字境界を含める
- **テキストを空にして保存したらドキュメントを削除**（空メモを残さない。marks の「全フラグOFFで削除」と同じ流儀）
- 既存 marks ドキュメントへの相乗りは不採用: marks は「wishlist/favorite が両方 false になるとドキュメントごと削除」するため、メモが道連れで消える事故と構造的に相性が悪い
- localStorage も不採用: 端末間で共有されず世帯共有の前提に反する

### 2. ストア（新規 `src/facilityNotes.ts`）

marks.ts の FirestoreMarkStore と同型:

```ts
export interface FacilityNote { text: string; updatedAt: Timestamp | null }
export type FacilityNoteMap = Record<string, FacilityNote>;
export interface FacilityNoteStore {
  save(facilityId: string, text: string): Promise<void>; // trim後に空なら delete
  subscribe(onNotes: (notes: FacilityNoteMap) => void, onError: (error: Error) => void): () => void;
}
```

- `save` は `runTransaction` 不要（単一フィールドの上書き/削除のみ。`setDoc`/`deleteDoc` で足りる）
- `subscribe` はコレクション全件購読（marks と同じ。エクスポートでも全件必要）。メモが1,000件前後を超えたら詳細画面単位の取得へ移行する（Spark 無料枠 50,000 reads/日に対する運用目安。現在の家族利用では全件購読で問題ない）
- UI 側に saving 状態を持ち、保存ボタンの連打（重複送信）を防ぐ
- 生成は `src/main.tsx`（他ストアと同じ場所）

### 3. セキュリティルール（firestore.rules）

```
function validFacilityNote(data) {
  return data.keys().hasAll(["text", "updatedAt"])
    && data.keys().hasOnly(["text", "updatedAt"])
    && data.text is string
    && data.text.size() >= 1
    && data.text.size() <= 2000
    && data.updatedAt == request.time;
}
```

- `updatedAt == request.time` で `serverTimestamp()` 以外の時刻を拒否する（既存 visits ルールと同方式）
- rules テスト項目: 0文字／空白のみ相当（trim済み保存が前提のため text=" " は1文字として通る点を仕様として明記）／2000字／2001字／不正フィールド／updatedAt が serverTimestamp 以外／他 UID 拒否／delete 成功

- `households/{hid}/facilityNotes/{facilityId}` に `isHousehold(hid)` ＋上記検証で read/write/delete を許可
- ルール変更は本番デプロイ（`firebase deploy --only firestore:rules`）が必要

### 4. UI（VisitPanel 内・訪問記録セクションの下）

- 見出し「施設メモ」の独立セクション
- **表示モード**: メモ本文（pre-wrap）＋更新日（small）＋「編集」ボタン。メモ未作成時は「メモを追加」ボタンのみ
- **編集モード**: textarea（maxLength 2000）＋「保存」「キャンセル」。visit-form の部品・配色を流用
- 保存失敗はセクション内にエラーメッセージ（visit-error と同じ見た目）
- **初回購読が完了するまで（notesLoading 中）は編集ボタンを出さない**。「未読」と「メモなし」を区別し、既存メモが見えていない状態での上書き事故を防ぐ
- 読み込みエラー時も編集ボタンを無効化し「メモを読み込めませんでした」を表示（誤上書き防止）
- CSS クラスは `.facility-user-note` 系とする（施設マスタ補足の既存 `.facility-note` と衝突させない）
- 保存失敗時は入力内容を保持したまま再試行できる（編集モードを維持）
- **編集中は SW 更新の自動リロードを保留**する。VisitPanel 内で「訪問記録フォーム or 施設メモフォームのどちらかが開いている」を集約した単一の editing 値を 1 つの effect から `onEditingChange` で通知する（2つのフォームが別々に通知すると、片方が閉じたときにもう片方が開いているのに false を送る競合が起きるため）

### 5. App.tsx の配線

- `facilityNoteStore` prop 追加 → `notes` を購読（visits/marks と同じ effect パターン、エラー state 付き）
- VisitPanel に `note={notes?.[facility.id]}`・`noteStore`・`noteLoadError` を渡す
- エクスポートの not-ready 判定に notes の読み込み状態を追加

### 6. エクスポート（buildExport.ts）

- `EXPORT_SCHEMA_VERSION` を 1→**2** に上げる
- `ExportData` に `facilityNotes: { facilityId: string; text: string; updatedAt: string | null }[]` と `counts.facilityNotes` を追加。updatedAt は visits と同じ ISO 文字列変換（serverTimestamp 反映前の null を許容）、配列は facilityId 順に安定ソート
- 将来インポートを作る際の指針をコメントで残す: v1 は facilityNotes=[] として読む／counts は信用せず配列から再計算

## 変更ファイル一覧

| ファイル | 変更 |
|---|---|
| `src/facilityNotes.ts`（新規） | ストア実装 |
| `firestore.rules` | validFacilityNote ＋ match ブロック |
| `src/main.tsx` | ストア生成・App へ渡す |
| `src/App.tsx` | 購読・prop 配線・export 連携 |
| `src/VisitPanel.tsx` | 施設メモセクション |
| `src/styles.css` | セクションのスタイル（整形済み形式で追記） |
| `src/buildExport.ts` | schemaVersion 2・facilityNotes 追加 |
| テスト | facilityNotes 単体・VisitPanel UI・buildExport・rules 統合（Windows のみ実行可） |

実装ファイル5つ超のため、実装時は deep-code を呼び、コミットを分割する。

## 実装順序（コミット単位）

1. ストア＋rules＋rules テスト（`npm run test:rules` で検証。Windows）
2. App 配線＋VisitPanel UI＋スタイル＋UI テスト（`npx vitest run` で検証）
3. buildExport 拡張＋テスト
4. デプロイ（Pages＋firestore.rules 本番反映）・実機確認

## 検証（完了の定義）

- 全単体テスト・test:rules・lint・build 通過
- 実機（公開URL）で: メモ追加→リロードで残存→編集→空にして保存でドキュメント削除、を目視確認
- JSONエクスポートに facilityNotes が含まれることを確認

## リスク・注意点

- 並行セッションがステップ11（PWA）を実装中。`swUpdate.setEditing`・`onEditingChange` の経路は並行側の実装に合わせ、着手時点の最新 main を必ず pull してから開始する
- 同時編集は最終保存勝ち（意図的な割り切り）
- エクスポートの schemaVersion を上げるため、インポート機能を将来作る際は両バージョン対応が必要

## エッジケース

- 空・空白のみの保存 → trim して空ならドキュメント削除（「メモなし」状態へ戻る）
- 2000字超 → textarea の maxLength ＋保存前検証で拒否（rules でも拒否される）
- 絵文字・改行を含むメモ → pre-wrap 表示。JS の length と rules の size() は Unicode 境界で不一致がありうるため、境界値テスト（絵文字で2000字前後）を必ず入れる
- オフライン保存 → Firestore SDK のリトライに任せ、エラー時はメッセージ表示
- メモ読み込み失敗中の編集 → 編集ボタン無効化（古い内容への上書き防止）
- カスタム施設の削除 → メモは残置し、エクスポートにも含める（訪問記録と同じ方針。孤児データは実害なし）。施設削除の確認文言にメモが残る旨は含めない（訪問記録も同様のため）

## Codex レビュー

2026-07-15 実施（design_review）。結論は「骨格は妥当・条件付き」で、以下を反映済み:

- **updatedAt は serverTimestamp()＋rules で `updatedAt == request.time` 検証**（クライアント時計を信頼しない。既存 visits と同方式）
- **notesLoading の導入**: 初回購読完了前は編集ボタンを出さず、「未読」と「メモなし」を区別（既存メモの上書き事故防止）
- **編集状態の集約**: 訪問記録フォームと施設メモフォームの editing を VisitPanel 内で OR 集約し単一 effect から通知（二重コールバックによる誤 false 通知の防止）
- **エクスポート形式の明示**: updatedAt は ISO 文字列 | null、facilityId 順ソート、v1 バックアップの将来の読み方
- **trim・Unicode 境界の明文化**: trim して保存、JS length と rules size() の不一致を境界値テストで担保
- **CSS クラス名の衝突回避**: 既存 `.facility-note`（施設マスタ補足）と別名の `.facility-user-note` 系にする
- **全件購読の移行条件**: 1,000件前後を超えたら詳細画面単位の取得へ（Spark 50,000 reads/日基準の運用目安）
- **保存ボタンの連打防止（saving 状態）・保存失敗時の入力保持**
- rules テスト項目の具体化（境界値・serverTimestamp 以外の拒否・他 UID 拒否・delete）

採用済みの提案: setDoc/deleteDoc で実装しトランザクションは使わない（単一ドキュメントの完全上書き/削除に競合統合の余地はなく、最終保存勝ちの仕様と整合）。

見送った指摘: カスタム施設削除の確認文言へのメモ残置の明記（訪問記録も同じ扱いで文言に含めていないため、一貫性を優先）。
