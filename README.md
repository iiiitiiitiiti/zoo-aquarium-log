# zoo-aquarium-log

全国の動物園・水族館をリストアップし、家族で訪問記録をつけるスマホ中心の Web アプリ（PWA予定）。

- 公開URL: https://iiiitiiitiiti.github.io/zoo-aquarium-log/
- 実装プラン: [docs/plan.md](docs/plan.md)
- 初期公開版: 公式情報で確認したパイロット20施設の検索・種別絞り込み
- 構成: Vite + React + TypeScript。今後 Firebase Firestore とPWA対応を追加予定

## 開発

```bash
npm install
npm run dev
npm run test:data
npm test -- --run
npm run build
```

## 運用メモ

- Mac ⇔ Windows の受け渡しはこのリポジトリ（GitHub）経由で行う
- `main` へのpushでGitHub ActionsからPagesへデプロイする
