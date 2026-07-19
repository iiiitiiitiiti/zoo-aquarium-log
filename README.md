# zoo-aquarium-log

全国の動物園・水族館を収録し、家族で訪問記録をつけるスマホ中心の PWA。

- 公開URL: https://iiiitiiitiiti.github.io/zoo-aquarium-log/
- 実装プラン: [docs/plan.md](docs/plan.md)（ステップ1〜11 すべて実装済み）
- 施設マスタ: 全47都道府県 473施設（一次情報で全件調査済み。閉園・休園も記録として収録）
- 主な機能: 検索・都道府県/種別フィルタ、訪問記録（写真・評価・Markdown メモ）、行きたい/お気に入り、施設メモ、手動施設追加、地図表示（Leaflet）、統計、JSON エクスポート
- 構成: Vite + React + TypeScript ＋ Firebase（Auth / Firestore / Storage）。GitHub Pages で配信、Service Worker によるオフライン対応

一覧画面の「データをJSONで保存」から、Firestore上の世帯データ（訪問記録・メモ・マーク・手動追加施設）をバックアップできます。静的施設マスタと写真データの実体はJSONに含まれないため、単独では施設名や写真まで復元できません。

## 複数世帯アカウント

複数世帯の切り替え基盤を実装しています。現在は既存の「家族」アカウントのみ利用可能で、世帯B・世帯Cは実ユーザー確定後に有効化します。運用上の注意と有効化手順は [docs/2026-07-17-multi-account.md](docs/2026-07-17-multi-account.md) を参照してください。
## 開発

```bash
npm install
npm run dev
npm run test:data
npm run test:rules  # Firestore / Storage Emulator の実行に Java 21 以上が必要
npm test -- --run
npm run build
```

データ検証・監査用スクリプト:

```bash
npm run check:duplicates   # 施設マスタの重複候補
npm run check:links        # 収録URLの死活監査
node scripts/check-geo.mjs # 座標の都道府県整合
```

## 運用メモ

- Mac ⇔ Windows の受け渡しはこのリポジトリ（GitHub）経由で行う
- `main` へのpushでGitHub ActionsからPagesへデプロイする
- 施設マスタの包含基準・ID規約は [docs/facility-criteria.md](docs/facility-criteria.md)
- 施設情報は定期監査で追跡する（URL 劣化・休閉園の変化。直近の監査記録は docs/2026-07-15-step7-progress.md）
