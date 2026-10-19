## 002. firebase の中の @grpc/grpc-js は overrides で 1.14 系に上げる

- 日付: 2026-10-19
- 対象: `package.json` の `overrides`、`package-lock.json`

### 決定

`@grpc/grpc-js` を overrides で `^1.14.6` に固定した。firebase 12 系は最新版（13.0.0 も含む）でも `@firebase/firestore` が `~1.9.0` を指定しているので、firebase を上げても脆弱な版が残るからである。firebase が 1.14 系以上を自分で指定するようになったら、この overrides は外してよい。

### 背景

2026-10-19 の部品の更新チェックで、本番用の依存に high が4件出た（firebase・@firebase/firestore・@firebase/firestore-compat・@grpc/grpc-js）。原因はどれも `@grpc/grpc-js <=1.13.5` だった。grpc-js は firestore を Node で使うときにだけ読み込まれる。ブラウザ向けのビルドは WebChannel で通信するので、公開サイトの成果物（`dist/`）には入っていない（ビルド結果を検索して確認済み）。

### 比較した代替案

| 案 | 却下理由 |
|---|---|
| `npm audit fix --force`（firebase 9.14.0 へ下げる） | 3世代前への版下げで、モジュラー API などの前提が崩れる |
| firebase 13 へ上げる | 13.0.0 も grpc-js `~1.9.0` のままで解消しない。今回の依頼の範囲外でもある |
| 何もしない（公開サイトに入らないので実害なしとして記録だけ残す） | 実害は無いが毎月の点検で同じ指摘が出続ける。上書きしても全テストが通ったので、上げるほうを採った |

### 影響範囲

- grpc-js を実際に使うのは Node で動く統合テスト（`npm run test:rules`）だけ
- firebase を上げるときは、`npm ls @grpc/grpc-js` で firestore が指定する範囲を見て、overrides が要るか判断する

### 検証

上書き後に `npm audit --omit=dev` が0件になった。`npm run lint`・`npm run test:data`（19件）・`npx vitest --run`（165件）・`npm run build`・`npm run test:rules`（28件）がすべて通った。統合テストで Firestore の読み書きや購読が失敗するようになったら、この上書きを疑う。

### 関連ファイル

- `package.json`
- `package-lock.json`
