# 施設フル住所 候補台帳（2026-07-15）

施設詳細ページへのフル住所追加のための調査台帳。AI が公式サイトのアクセス情報等から住所候補を収集し、人間が不確実な施設を確認してから `src/data/facilities.json` へ反映する。**この台帳から確認なしに本番マスタへ自動反映しない。**

## ファイル構成

- `input/input-teamNN.json` — 各調査班への入力（facilities.json の分割。id・name・pref・city・status・url・sourceUrls）
- `address-teamNN.json` — 各調査班の出力（下記レコード形式）

## レコード形式

```json
{
  "id": "hokkaido_asahiyama_zoo",
  "name": "旭川市旭山動物園",
  "address": "北海道旭川市東旭川町倉沼",
  "addressSourceUrl": "https://www.city.asahikawa.hokkaido.jp/asahiyamazoo/xxxx.html",
  "confidence": "high",
  "note": ""
}
```

- `address`: 都道府県から始まるフル住所。郵便番号（〒XXX-XXXX）・施設名・電話番号は含めない。出典ページの表記をそのまま使う（勝手に正規化しない）
- `addressSourceUrl`: 住所が実際に記載されていた、実際に取得したページの URL
- `confidence`:
  - `high` — 公式サイト（施設自身または運営自治体・運営会社）の記載を逐語確認
  - `medium` — 公式系ページだが記載が曖昧／PDF 等で一部確認
  - `unconfirmed` — 公式情報を確認できず。`address` は空文字にし、`note` に理由を書く（**推測で埋めない**）
- `note`: 特記事項（閉園時の所在地である旨、複数所在地、表記ゆれ、取得エラーなど）
