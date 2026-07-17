# zoo-aquarium-log 複数アカウント対応＋切り替え機能 実装プラン

## Context

現状、アプリは世帯共有 Firebase Auth アカウント1つ（固定メール＋合言葉）に紐づいており、利用者は自分の家族のみ。これにアカウントを2つ追加して計3世帯が使えるようにし、端末上でのアカウント切り替え機能を実装する。

- **データは完全分離**（2026-07-17 ユーザー決定）: 各アカウントは自分の `households/{自分のuid}` のみ読み書きでき、他アカウントのデータは見えない
- **切り替えはワンタップ**（同上）: 一度ログインしたアカウントの合言葉を端末（localStorage）に記憶し、以後はアカウント選択だけで切り替え。未ログインのアカウントへの切り替え時のみ合言葉入力
- **このプランの承認後は、プランを `docs/` へ保存するのみで実装には移らない**（2026-07-17 ユーザー指示）

## 現状の構成（調査済み）

- 認証: `src/firebase.ts` に固定メール `2190agiatotomijuf@gmail.com` と `HOUSEHOLD_UID`（`cbs9TeeZ...`）がハードコード。合言葉 = Firebase Auth のパスワードとして `signInWithEmailAndPassword` で認証
- `src/AuthGate.tsx`: `AuthClient` インターフェースは `onAuthStateChanged(listener: (signedIn: boolean) => void)` の真偽値契約。合言葉フォーム・ログアウト処理を持ち、render-prop で `AuthSessionControls` を App へ渡す
- `src/main.tsx`: モジュールトップレベルで5つの Store（visits / visitPhotos / marks / customFacilities / facilityNotes）を `HOUSEHOLD_UID` 固定で1回だけ生成
- `src/App.tsx`: Store は props 受け取りで、購読 `useEffect` は `[store]` 依存 — **Store 参照が変われば自動で unsubscribe → 再 subscribe される設計に既になっている**
- `firestore.rules` / `storage.rules`: `isHousehold(hid)` が `request.auth.uid == hid && hid == "cbs9TeeZ..."` の単一 UID 直書き
- Firestore のオフライン永続化（IndexedDB persistence）は未使用。SW キャッシュは静的アセットのみ → 切替時のキャッシュ混入の考慮は不要
- ルールの本番反映は `firebase deploy --only firestore:rules(,storage)` の手動運用（docs/2026-07-15-facility-notes.md 参照）
- `tests/firestore.rules.test.ts` に別 UID 拒否の負例テストあり。storage.rules のテストは現状存在しない

## 設計方針

1. **アカウント定義の一元化**: 新規 `src/accounts.ts` に `AccountConfig { uid, email, label }` の配列 `ACCOUNTS` を定義。既存の `HOUSEHOLD_UID` / `HOUSEHOLD_EMAIL` はここへ吸収し、`firebase.ts` は特定 UID を知らない汎用認証ラッパーに格下げ
2. **AuthClient の契約変更**: `onAuthStateChanged(listener: (uid: string | null) => void)`、`signIn(email, password, expectedUid)` に変更。サインイン成功後に uid 不一致なら signOut して例外（現行ガードの引数化）。状態の意味は現行を維持: `undefined`=初回確認中 / `null`=未ログイン / `string`=ログイン済み。splash-ready イベントの発火条件（`uid !== undefined`）も維持する
3. **Store の動的生成**: `main.tsx` に `AuthenticatedApp` コンポーネントを新設し、`useMemo(() => new Store(db, uid), [uid])` で生成。**`<AuthenticatedApp key={uid}>` として Store 生成を含む境界全体をフルリマウント**させ、UI 状態（検索条件・編集中フォーム等）の世帯間リークを構造的に防ぐ（render-prop の children 内で直接 hooks を呼ぶと呼び出し順序が壊れるため、専用コンポーネント切り出しは必須）
4. **切り替え UX**: 「サインイン中に別ユーザーで `signInWithEmailAndPassword`」でセッションを直接切り替え、明示的な signOut を挟まず未ログイン画面のちらつきを避ける。ただし **`onAuthStateChanged` の発火順（旧uid→null→新uid か直接遷移か）は SDK の契約外**なので順序に依存せず、AuthGate に `switching(targetUid)` 状態を設けて切替中の一時的な `null` でログイン画面を出さない・連続切替（A→B→C の競合）を防ぐ。切替失敗時は旧アカウントの UI を維持する。**アカウント選択 UI はログイン前画面にも置く**（未ログインの世帯B/C が初回利用できるように。ログイン前とログイン後の切替 UI は同じ `AccountPicker` を共有）。編集中・写真アップロード中の切替はリマウントで内容が破棄されるため、切替時に確認ダイアログ（破棄の注意文言）を挟む
5. **合言葉の記憶**: localStorage に `{ [uid]: 合言葉 }` を**平文** JSON で保存(キー例: `zoo-aquarium-log:remembered-accounts:v1`）。難読化は防御効果ゼロなので行わない（誤った安心感を与えない）。保存は **uid 検証を通ったサインイン成功後のみ**。安全弁として「この端末の記憶を削除」ボタンを世帯ごとに設置（削除対象は保存済み合言葉のみで、現在の Auth セッションは切らない、と UI 文言で明示）
6. **ルールの許可リスト化**: `isHousehold(hid)` を `request.auth.uid == hid && hid in [UID×3]` に変更。firestore.rules / storage.rules の両方（Rules に import 機構が無いため重複記載し、「UID の正本は src/accounts.ts」とコメントで明記）
7. **UI 文言**: 既存トーン（「家族のログ」「FAMILY FIELD NOTE」）に合わせ、「アカウント」ではなく「世帯」系の文言を採用（例:「別の世帯に切り替える」）。各世帯の表示名 `label` は実装時にユーザーへ確認

### セキュリティの検証（設計判断の根拠）

- **許可リスト方式の安全性**: 攻撃者は公開 API キーで `createUserWithEmailAndPassword` により新規アカウントを自由に作れるが、その UID が許可リストの3件と一致することは構造的にない（単一 UID 直書きと同等の安全性）。Firebase Auth 無料枠では自己サインアップの完全遮断はできないが、データ漏洩には直結しないため許容
- **localStorage 平文保存のリスク**: 端末を共有・紛失した場合、開発者ツール等で合言葉が読める。家族共用端末での利用リスクは README / docs に明記する。XSS が無いことが前提（施設メモの Markdown は dompurify サニタイズ済みを確認）

## 実装ステップ

| # | 内容 | 変更ファイル | 完了確認 |
|---|---|---|---|
| 0 | （手動）Firebase Console で2ユーザー追加・UID 記録。**Gmail エイリアス（+b/+c）で別ユーザーとして作成できることをこの時点で実地確認**（メール正規化で弾かれないか） | Console | Authentication > Users に3件、UID をメモ |
| 1 | `accounts.ts` 新規作成（UID はプレースホルダー可） | `src/accounts.ts` | `npm run lint` 通過 |
| 2 | 認証の縦切り改修: `firebase.ts`（uid ベース契約）＋ `AuthGate.tsx`（切替中状態・remembered 管理・切替 API）＋ FakeAuthClient を**1ステップで一括変更**（型が一時的に壊れる期間を作らない） | `src/firebase.ts`, `src/AuthGate.tsx`, `src/AuthGate.test.tsx` | `npm test -- --run src/AuthGate` green、ビルド通過 |
| 3 | `AccountPicker.tsx` 新規（ログイン前画面と切替 UI で共有） | `src/AccountPicker.tsx`, `src/AccountPicker.test.tsx` | 単体テスト green |
| 4 | `main.tsx` 分割（`AuthenticatedApp` 抽出・Store 動的生成・`<AuthenticatedApp key={uid}>`） | `src/main.tsx` | `npm run dev` 目視、既存 `App.test.tsx` 無改修で通過 |
| 5 | `App.tsx` hero-session 領域（511行目付近）に切替ボタン＋ピッカー（切替確認ダイアログ含む） | `src/App.tsx`, `src/App.test.tsx` | 新規テスト green。新 props は全てオプショナルにし既存テストを壊さない |
| 6 | storage rules テストの最小構成を先行検証（`@firebase/rules-unit-testing` の storage 初期化・`clearStorage()`・`test:rules` の `--only firestore,storage` 化） | `tests/storage.rules.test.ts`（新規）, `package.json`, `vitest.rules.config.ts` | 現行ルールのまま正例1件・負例1件が green |
| 7 | `firestore.rules` / `storage.rules` 許可リスト化 | `firestore.rules`, `storage.rules` | `npm run test:rules` green |
| 8 | rules テスト拡充: 3 UID 正例＋全クロスアクセス負例（正規の世帯B → 世帯Cのデータ拒否を含む）。**テストは `src/accounts.ts` の `ACCOUNTS` を import して UID 集合を生成**し、accounts.ts と rules の UID ずれを検出できる形にする | `tests/firestore.rules.test.ts`, `tests/storage.rules.test.ts` | `npm run test:rules` green |
| 9 | docs 更新（複数アカウント運用・localStorage リスク・リセットメールが同一受信箱に届き管理者代行になる制約を明記） | `README.md`, `docs/2026-07-XX-multi-account.md` | レビューのみ |
| 10 | （手動）ルール本番反映＋実機確認 | — | `firebase deploy --only firestore:rules,storage` 後、3世帯でデータ分離とワンタップ切替を目視確認 |

※ 3ファイル以上の変更のため、実装時は deep-code を呼ぶ。着手前に `npm test -- --run` がローカルで完走するか確認する（Codex 環境では124秒でタイムアウトしており、実行時間の切り分けが必要）。

## テスト計画

- **単体（vitest）**: AuthGate — remembered はタップのみでサインイン / 未 remembered は合言葉必須 / 成功時に localStorage 保存 / accounts に無い uid でサインイン状態なら強制サインアウト / **切替中の一時的な null でログイン画面を出さない / 連続切替の競合防止 / 切替失敗時に旧アカウント UI を維持** / localStorage の破損・空値・利用不可時に安全にフォールバック。AccountPicker — 表示分岐とコールバック。App — `accounts` 未指定時は切替ボタン非表示（後方互換）
- **rules 統合テスト（Firestore Emulator, Windows 実行）**: 3 UID それぞれの正例＋「正規の別世帯 UID → 他世帯データ」のクロスアクセス負例。購読系フレーキー（firebase-tools#8654）に注意 — 落ちたら回帰よりまずフレーキーを疑う
- **手動確認**: 3世帯サインイン→データ完全分離、ワンタップ切替、localStorage の保存形式を開発者ツールで確認

## 手動ステップ（Firebase Console）

1. Gmail エイリアスを決定（例: `2190agiatotomijuf+b@gmail.com` / `+c@gmail.com`）。**注意**: パスワードリセット等のメールは全て同一受信箱に届くため、各世帯のリセット運用は管理者が代行する前提になる
2. Console → Authentication → Users → Add user（メール＋初期合言葉）×2
3. User UID をコピーし、`src/accounts.ts` と両 rules のプレースホルダーを置換
4. `npm run test:rules` 通過後に `firebase deploy --only firestore:rules,storage`

## モデル采配（実装フェーズ・規律7）

| ステップ | 担当 |
|---|---|
| ステップ1・2（accounts.ts 新設、firebase.ts 改修 — 方針確定済みの小変更） | Sonnet サブエージェント |
| ステップ3〜6（AuthGate/main/App の構造変更 — 認証と状態管理の中核） | メイン（Fable。従量課金移行後は Opus） |
| ステップ7〜9（rules・テスト — セキュリティ境界） | メイン実装＋テスト green 確認 |
| ステップ10（docs） | Sonnet サブエージェント |
| 最終レビュー・本番反映判断 | メイン |

## 承認後の即時作業（履歴）

1. このプランを `c:\Users\fujimoto-taiga\dev\zoo-aquarium-log\docs\` へ保存（ファイル名: `2026-07-17-multi-account-plan.md`）
2. Notion Daily Worklog へ追記、必要なら Mac への引き継ぎ書を確認
3. ~~実装には移らない~~（後続の実装依頼により、この指示は上書き）

## Codex レビュー

2026-07-17 実施（codex exec、gpt-5.6-luna / reasoning xhigh）。結論は「条件付きで妥当」。決定事項（3アカウント・UID 別 Store・UID 許可リスト・平文 localStorage）は維持でよいとの判断。

**反映した指摘**:
- `onAuthStateChanged` の発火順（旧uid→null→新uid か直接遷移か）は SDK の契約外 → 順序に依存せず AuthGate に `switching(targetUid)` 状態を追加。切替中の一時 null でログイン画面を出さない・連続切替の競合防止・切替失敗時の旧 UI 維持（設計方針4、テスト計画）
- リマウント境界は `<App key={uid}>` より `<AuthenticatedApp key={uid}>`（Store 生成を含む境界全体）が明確 → 変更（設計方針3、ステップ4）
- アカウント選択はログイン前画面にも必要（未ログインの世帯B/C の初回利用） → 元プランでも AccountPicker 共有として想定していたが、設計方針4に明文化
- `undefined`（確認中）/ `null`（未ログイン）/ `string`（ログイン済み）の3値の意味と splash-ready 発火条件の維持を明記（設計方針2）
- firebase.ts だけ先に変えると型が一時的に壊れる → firebase.ts＋AuthGate＋FakeAuthClient を1ステップの縦切りに統合（ステップ2）
- 合言葉の保存は uid 検証後のみ、「記憶を削除」の削除対象（保存合言葉のみ・Auth セッションは切らない）を明示（設計方針5）
- 編集中・アップロード中の切替はリマウントで破棄される → 切替時に確認ダイアログ（設計方針4、ステップ5）
- accounts.ts と rules の UID ずれをテストで検出 → rules テストが `ACCOUNTS` を import して UID 集合を生成（ステップ8）
- storage rules テストは具体構成を先に小さく検証（ステップ6）。Gmail エイリアスで別ユーザー作成できるかは Console で実地確認（ステップ0）
- Codex 環境で `npm test -- --run` が124秒タイムアウト → 実装着手前にローカルでのテスト完走を確認する注記を追加

**見送った指摘**:
- custom claims / membership ドキュメント方式 — Codex 自身も「Spark 制約と現要件から採用しない」と結論。管理サーバーが必要で過剰
- sessionStorage / IndexedDB / Web Crypto 暗号化 — いずれも XSS 前提の平文リスクを本質的に解消しないため、要件どおり localStorage 平文＋リスク明記とする（Codex も同意見）
- 別タブでの Auth 状態変更・URL hash の世帯固有画面 — 現アプリは hash ルーティングで世帯固有 URL を持たず、別タブ同時利用は家族3世帯の運用では稀。実機確認の観点にのみ含め、専用の対策コードは書かない（YAGNI）

## 実装結果（2026-07-17）

アプリ側の複数世帯対応基盤を実装した。実ユーザーのUID・メールアドレスが未確定のため、世帯B・世帯Cはプレースホルダーのまま、Firestore RulesとStorage Rulesの本番許可リスト変更は保留している。詳細は [2026-07-17-multi-account.md](2026-07-17-multi-account.md) に記録する。