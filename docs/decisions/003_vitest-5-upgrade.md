## 003. vitest は npm の提案（4.1.12）ではなく最新の 5 系へ上げ、firebase-tools は版下げしない

- 日付: 2026-10-19
- 対象: `package.json` の `devDependencies`、`package-lock.json`

### 決定

vitest を `^3.0.0` から `^5.0.5` へ上げた。critical 2件の原因 tinypool は版上げでしか消えず、5 系は今の vite 7 にも対応していて、上げても全テストが通ったからである。firebase-tools 由来の残り7件（high 3・moderate 4）は、npm が勧める版下げをせずに残す。

### 背景

2026-10-19 の安全点検で、開発用の依存に critical 2件（tinypool <=2.1.1、GHSA-5gmw-xhrv-c9v3 / GHSA-85c8-ppgw-ccpr）が出た。tinypool は vitest 3 が引き込んでいた。本番用の依存（`npm audit --omit=dev`）は版上げ前から0件で、公開サイトへの影響は無い。

### 比較した代替案

| 案 | 却下理由 |
|---|---|
| vitest 4.1.12（`npm audit fix --force` の提案） | 解消はするが最新ではなく、近いうちにもう一度上げることになる。5 系で全テストが通ったので一度で済ませた |
| `npm audit fix --force` をそのまま実行 | firebase-tools を 15 から 14.23.0 へ版下げしてしまう。古い版へ戻すと別の不具合や非対応を抱える |
| 何もしない | 開発用だけとはいえ critical が残り、毎月の点検で指摘され続ける |

### 影響範囲

- 単体テスト（`npm test`）とルールのテスト（`npm run test:rules`）はどちらも vitest 5 で走る
- firebase-tools 由来の7件は、firebase-tools 側が依存を更新した版が出たら上げて消す。版下げは提案されても採らない

### 検証

版上げ後に `npm run lint`・`npm run test:data`（19件）・`npx vitest --run`（23ファイル165件）・`npm run build` がローカルで通った。Mac に Java が無いため `npm run test:rules` は GitHub Actions（Java 21）で実行し、build・deploy とも成功した。`npm audit` は 10件から7件になり critical は0件になった。

### 関連ファイル

- `package.json`
- `package-lock.json`
- `.github/workflows/deploy-pages.yml`
