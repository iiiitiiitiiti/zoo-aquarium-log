export interface Prefecture {
  name: string;
  capital: string;
  lat: number;
  lng: number;
}

export const prefectures: Prefecture[] = [
  { name: "北海道", capital: "札幌市", lat: 43.0618, lng: 141.3545 },
  { name: "青森県", capital: "青森市", lat: 40.8244, lng: 140.74 },
  { name: "岩手県", capital: "盛岡市", lat: 39.7036, lng: 141.1527 },
  { name: "宮城県", capital: "仙台市", lat: 38.2682, lng: 140.8694 },
  { name: "秋田県", capital: "秋田市", lat: 39.7186, lng: 140.1024 },
  { name: "山形県", capital: "山形市", lat: 38.2554, lng: 140.3396 },
  { name: "福島県", capital: "福島市", lat: 37.7608, lng: 140.4747 },
  { name: "茨城県", capital: "水戸市", lat: 36.3418, lng: 140.4468 },
  { name: "栃木県", capital: "宇都宮市", lat: 36.5657, lng: 139.8836 },
  { name: "群馬県", capital: "前橋市", lat: 36.3911, lng: 139.0608 },
  { name: "埼玉県", capital: "さいたま市", lat: 35.8569, lng: 139.6489 },
  { name: "千葉県", capital: "千葉市", lat: 35.6074, lng: 140.1065 },
  { name: "東京都", capital: "新宿区", lat: 35.6895, lng: 139.6917 },
  { name: "神奈川県", capital: "横浜市", lat: 35.4478, lng: 139.6425 },
  { name: "新潟県", capital: "新潟市", lat: 37.9026, lng: 139.0232 },
  { name: "富山県", capital: "富山市", lat: 36.6953, lng: 137.2113 },
  { name: "石川県", capital: "金沢市", lat: 36.5947, lng: 136.6256 },
  { name: "福井県", capital: "福井市", lat: 36.0652, lng: 136.2216 },
  { name: "山梨県", capital: "甲府市", lat: 35.6642, lng: 138.5684 },
  { name: "長野県", capital: "長野市", lat: 36.6513, lng: 138.181 },
  { name: "岐阜県", capital: "岐阜市", lat: 35.3912, lng: 136.7223 },
  { name: "静岡県", capital: "静岡市", lat: 34.9769, lng: 138.3831 },
  { name: "愛知県", capital: "名古屋市", lat: 35.1802, lng: 136.9066 },
  { name: "三重県", capital: "津市", lat: 34.7303, lng: 136.5086 },
  { name: "滋賀県", capital: "大津市", lat: 35.0179, lng: 135.8546 },
  { name: "京都府", capital: "京都市", lat: 35.0116, lng: 135.7681 },
  { name: "大阪府", capital: "大阪市", lat: 34.6863, lng: 135.52 },
  { name: "兵庫県", capital: "神戸市", lat: 34.6913, lng: 135.183 },
  { name: "奈良県", capital: "奈良市", lat: 34.6851, lng: 135.8048 },
  { name: "和歌山県", capital: "和歌山市", lat: 34.226, lng: 135.1675 },
  { name: "鳥取県", capital: "鳥取市", lat: 35.5011, lng: 134.2351 },
  { name: "島根県", capital: "松江市", lat: 35.4723, lng: 133.0505 },
  { name: "岡山県", capital: "岡山市", lat: 34.6618, lng: 133.9344 },
  { name: "広島県", capital: "広島市", lat: 34.3966, lng: 132.4596 },
  { name: "山口県", capital: "山口市", lat: 34.1859, lng: 131.4714 },
  { name: "徳島県", capital: "徳島市", lat: 34.0658, lng: 134.5593 },
  { name: "香川県", capital: "高松市", lat: 34.3401, lng: 134.0434 },
  { name: "愛媛県", capital: "松山市", lat: 33.8416, lng: 132.7657 },
  { name: "高知県", capital: "高知市", lat: 33.5597, lng: 133.5311 },
  { name: "福岡県", capital: "福岡市", lat: 33.6064, lng: 130.4183 },
  { name: "佐賀県", capital: "佐賀市", lat: 33.2494, lng: 130.2988 },
  { name: "長崎県", capital: "長崎市", lat: 32.7448, lng: 129.8737 },
  { name: "熊本県", capital: "熊本市", lat: 32.7898, lng: 130.7417 },
  { name: "大分県", capital: "大分市", lat: 33.2382, lng: 131.6126 },
  { name: "宮崎県", capital: "宮崎市", lat: 31.9111, lng: 131.4239 },
  { name: "鹿児島県", capital: "鹿児島市", lat: 31.5602, lng: 130.5581 },
  { name: "沖縄県", capital: "那覇市", lat: 26.2124, lng: 127.6809 },
];

export function prefectureCoordinates(name: string) {
  const prefecture = prefectures.find((item) => item.name === name);
  return prefecture ? { lat: prefecture.lat, lng: prefecture.lng } : undefined;
}
