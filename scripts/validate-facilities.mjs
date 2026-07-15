import { japanBounds, isInsideAnyBox } from "./pref-bounds.mjs";

const idPattern = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const allowedTypes = new Set(["zoo", "aquarium", "both", "other"]);
const allowedStatuses = new Set(["open", "closed", "suspended"]);

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateFacilities(facilities) {
  if (!Array.isArray(facilities) || facilities.length === 0) {
    return ["施設は1件以上必要です"];
  }

  const errors = [];
  const seenIds = new Set();

  facilities.forEach((facility, index) => {
    const label = `[${index}] ${facility?.name ?? "名称未設定"}`;
    for (const [key, title] of [["name", "名称"], ["kana", "読み仮名"], ["pref", "都道府県"], ["city", "市区町村"]]) {
      if (typeof facility?.[key] !== "string" || facility[key].trim() === "") errors.push(`${label}: ${title}は必須です`);
    }
    if (!allowedTypes.has(facility?.type)) errors.push(`${label}: 種別が不正です`);
    if (!allowedStatuses.has(facility?.status)) errors.push(`${label}: 営業状態が不正です`);

    if (!idPattern.test(facility?.id ?? "")) errors.push(`${label}: IDは小文字スネークケースにしてください`);
    if (facility?.id?.startsWith("custom_")) errors.push(`${label}: custom_ は手動追加施設の予約IDです`);
    if (seenIds.has(facility?.id)) errors.push(`${label}: IDが重複しています (${facility.id})`);
    seenIds.add(facility?.id);

    if (typeof facility?.lat !== "number" || facility.lat < -90 || facility.lat > 90) errors.push(`${label}: 緯度は-90から90の数値にしてください`);
    if (typeof facility?.lng !== "number" || facility.lng < -180 || facility.lng > 180) errors.push(`${label}: 経度は-180から180の数値にしてください`);
    if (typeof facility?.lat === "number" && typeof facility?.lng === "number" && !isInsideAnyBox(facility.lat, facility.lng, japanBounds)) {
      errors.push(`${label}: 座標が日本の範囲外です`);
    }
    if (!isHttpUrl(facility?.url)) errors.push(`${label}: 公式URLが不正です`);
    if (!Array.isArray(facility?.sourceUrls) || facility.sourceUrls.length === 0 || facility.sourceUrls.some((url) => !isHttpUrl(url))) errors.push(`${label}: 一次情報URLを1件以上指定してください`);
    if (!datePattern.test(facility?.lastVerifiedAt ?? "")) errors.push(`${label}: 確認日はYYYY-MM-DD形式にしてください`);
    if (facility?.note !== undefined && (typeof facility.note !== "string" || facility.note.trim() === "" || facility.note.length > 500)) {
      errors.push(`${label}: 補足（note）は1〜500文字の文字列にしてください（不要なら項目ごと省略）`);
    }
    if (facility?.address !== undefined) {
      if (typeof facility.address !== "string" || facility.address.trim() === "" || facility.address.length > 200) {
        errors.push(`${label}: 住所（address）は1〜200文字の文字列にしてください（不要なら項目ごと省略）`);
      } else if (typeof facility?.pref === "string" && facility.pref !== "" && !facility.address.startsWith(facility.pref)) {
        errors.push(`${label}: 住所（address）は都道府県（${facility.pref}）から始めてください`);
      }
    }
  });

  return errors;
}
