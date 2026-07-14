// 47都道府県のバウンディングボックス（警告用途の近似値）。
// 出典: 一般的な地理知識に基づく近似値（行政区域ポリゴンではない）。県境を厳密になぞらない。
// 作成日: 2026-07-15
// 座標系: WGS84 (lat/lng, 単位: 度)
//
// 離島散在県（東京都・鹿児島県・長崎県・沖縄県・島根県）は boxes に複数ボックスを持ち、
// いずれか1つに入れば inside 判定とする（OR判定）。
// 県庁所在地・主要離島を確実に含むよう、実際の県域よりやや広めにマージンを取っている。

export const prefBounds = {
  "北海道": { boxes: [{ minLat: 41.0, maxLat: 45.8, minLng: 139.2, maxLng: 149.0 }] },
  "青森県": { boxes: [{ minLat: 40.1, maxLat: 41.7, minLng: 139.4, maxLng: 141.8 }] },
  "岩手県": { boxes: [{ minLat: 38.6, maxLat: 40.6, minLng: 140.5, maxLng: 142.2 }] },
  "宮城県": { boxes: [{ minLat: 37.7, maxLat: 39.0, minLng: 140.2, maxLng: 141.8 }] },
  "秋田県": { boxes: [{ minLat: 38.7, maxLat: 40.6, minLng: 139.6, maxLng: 141.0 }] },
  "山形県": { boxes: [{ minLat: 37.6, maxLat: 39.3, minLng: 139.3, maxLng: 140.7 }] },
  "福島県": { boxes: [{ minLat: 36.7, maxLat: 38.0, minLng: 139.1, maxLng: 141.2 }] },
  "茨城県": { boxes: [{ minLat: 35.6, maxLat: 37.0, minLng: 139.6, maxLng: 141.0 }] },
  "栃木県": { boxes: [{ minLat: 36.1, maxLat: 37.3, minLng: 139.2, maxLng: 140.4 }] },
  "群馬県": { boxes: [{ minLat: 35.8, maxLat: 37.0, minLng: 138.3, maxLng: 139.8 }] },
  "埼玉県": { boxes: [{ minLat: 35.6, maxLat: 36.4, minLng: 138.6, maxLng: 140.0 }] },
  "千葉県": { boxes: [{ minLat: 34.8, maxLat: 36.2, minLng: 139.6, maxLng: 141.0 }] },
  "東京都": {
    boxes: [
      { minLat: 35.5, maxLat: 35.9, minLng: 138.9, maxLng: 139.95 }, // 本土（23区・多摩）
      { minLat: 32.3, maxLat: 34.9, minLng: 139.0, maxLng: 139.9 }, // 伊豆諸島
      { minLat: 26.5, maxLat: 27.3, minLng: 142.0, maxLng: 142.3 }, // 小笠原諸島
    ],
  },
  "神奈川県": { boxes: [{ minLat: 35.0, maxLat: 35.8, minLng: 138.8, maxLng: 139.9 }] },
  "新潟県": { boxes: [{ minLat: 36.6, maxLat: 38.7, minLng: 137.5, maxLng: 140.0 }] },
  "富山県": { boxes: [{ minLat: 36.1, maxLat: 37.0, minLng: 136.7, maxLng: 137.8 }] },
  "石川県": { boxes: [{ minLat: 35.9, maxLat: 37.7, minLng: 136.1, maxLng: 137.5 }] },
  "福井県": { boxes: [{ minLat: 35.2, maxLat: 36.4, minLng: 135.3, maxLng: 136.9 }] },
  "山梨県": { boxes: [{ minLat: 35.1, maxLat: 36.0, minLng: 138.1, maxLng: 139.3 }] },
  "長野県": { boxes: [{ minLat: 35.1, maxLat: 37.1, minLng: 137.2, maxLng: 138.9 }] },
  "岐阜県": { boxes: [{ minLat: 35.0, maxLat: 36.6, minLng: 136.2, maxLng: 137.8 }] },
  "静岡県": { boxes: [{ minLat: 34.5, maxLat: 35.8, minLng: 137.4, maxLng: 139.3 }] },
  "愛知県": { boxes: [{ minLat: 34.5, maxLat: 35.5, minLng: 136.6, maxLng: 137.9 }] },
  "三重県": { boxes: [{ minLat: 33.6, maxLat: 35.4, minLng: 135.8, maxLng: 137.0 }] },
  "滋賀県": { boxes: [{ minLat: 34.7, maxLat: 35.8, minLng: 135.7, maxLng: 136.6 }] },
  "京都府": { boxes: [{ minLat: 34.6, maxLat: 35.9, minLng: 134.7, maxLng: 136.1 }] },
  "大阪府": { boxes: [{ minLat: 34.2, maxLat: 34.9, minLng: 135.0, maxLng: 135.8 }] },
  "兵庫県": { boxes: [{ minLat: 34.1, maxLat: 35.8, minLng: 134.1, maxLng: 135.6 }] },
  "奈良県": { boxes: [{ minLat: 33.8, maxLat: 34.9, minLng: 135.4, maxLng: 136.3 }] },
  "和歌山県": { boxes: [{ minLat: 33.3, maxLat: 34.5, minLng: 134.9, maxLng: 136.1 }] },
  "鳥取県": { boxes: [{ minLat: 35.0, maxLat: 35.7, minLng: 133.3, maxLng: 134.6 }] },
  "島根県": {
    boxes: [
      { minLat: 34.3, maxLat: 35.8, minLng: 131.6, maxLng: 133.5 }, // 本土
      { minLat: 35.9, maxLat: 36.5, minLng: 132.8, maxLng: 133.5 }, // 隠岐諸島
    ],
  },
  "岡山県": { boxes: [{ minLat: 34.2, maxLat: 35.5, minLng: 133.2, maxLng: 134.5 }] },
  "広島県": { boxes: [{ minLat: 33.9, maxLat: 35.0, minLng: 131.9, maxLng: 133.6 }] },
  "山口県": { boxes: [{ minLat: 33.6, maxLat: 34.9, minLng: 130.7, maxLng: 132.5 }] },
  "徳島県": { boxes: [{ minLat: 33.4, maxLat: 34.4, minLng: 133.5, maxLng: 134.9 }] },
  "香川県": { boxes: [{ minLat: 33.9, maxLat: 34.7, minLng: 133.3, maxLng: 134.6 }] },
  "愛媛県": { boxes: [{ minLat: 32.8, maxLat: 34.4, minLng: 131.9, maxLng: 133.8 }] },
  "高知県": { boxes: [{ minLat: 32.6, maxLat: 34.0, minLng: 132.4, maxLng: 134.4 }] },
  "福岡県": { boxes: [{ minLat: 33.0, maxLat: 34.1, minLng: 129.8, maxLng: 131.3 }] },
  "佐賀県": { boxes: [{ minLat: 32.8, maxLat: 33.7, minLng: 129.6, maxLng: 130.6 }] },
  "長崎県": {
    boxes: [
      { minLat: 32.5, maxLat: 33.9, minLng: 128.5, maxLng: 130.5 }, // 本土＋五島・壱岐
      { minLat: 34.0, maxLat: 34.8, minLng: 129.1, maxLng: 129.6 }, // 対馬
    ],
  },
  "熊本県": { boxes: [{ minLat: 32.0, maxLat: 33.3, minLng: 129.8, maxLng: 131.5 }] },
  "大分県": { boxes: [{ minLat: 32.6, maxLat: 33.9, minLng: 130.7, maxLng: 132.1 }] },
  "宮崎県": { boxes: [{ minLat: 31.2, maxLat: 32.9, minLng: 130.6, maxLng: 132.0 }] },
  "鹿児島県": {
    boxes: [
      { minLat: 30.0, maxLat: 32.3, minLng: 129.8, maxLng: 131.3 }, // 本土＋種子島・屋久島
      { minLat: 26.9, maxLat: 30.1, minLng: 128.8, maxLng: 130.2 }, // 奄美群島・トカラ列島
    ],
  },
  "沖縄県": {
    boxes: [
      { minLat: 25.7, maxLat: 27.9, minLng: 127.0, maxLng: 128.5 }, // 沖縄本島周辺
      { minLat: 24.5, maxLat: 25.0, minLng: 124.6, maxLng: 125.6 }, // 宮古諸島
      { minLat: 24.0, maxLat: 24.6, minLng: 122.9, maxLng: 124.4 }, // 八重山諸島
    ],
  },
};

// 日本全域の粗いボックス群。本土・沖縄/先島・小笠原をカバーし、
// 明白な異常（海外座標・緯度経度の取り違え等）だけを弾く粗さでよい。
export const japanBounds = [
  { minLat: 24.0, maxLat: 46.0, minLng: 122.0, maxLng: 146.5 }, // 本土（北海道〜九州・南西諸島含む広域）
  { minLat: 20.0, maxLat: 28.0, minLng: 122.0, maxLng: 154.0 }, // 沖縄・先島・小笠原・南鳥島など南方
];

/**
 * 座標がボックスの範囲内かどうかを判定する（境界値は inclusive）。
 */
export function isInsideBox(lat, lng, box) {
  return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
}

/**
 * 座標がボックス群のいずれかに入るかどうかを判定する（OR判定）。
 */
export function isInsideAnyBox(lat, lng, boxes) {
  return boxes.some((box) => isInsideBox(lat, lng, box));
}
