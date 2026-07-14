import { readFile } from "node:fs/promises";

// 種別語サフィックスは長いものから順に判定する（「動植物園」を「園」だけで削り過ぎない）
const TYPE_SUFFIXES = ["動植物公園", "動植物園", "動物園", "水族館", "サファリパーク", "ふれあい牧場", "パーク", "公園", "園", "館"];

/**
 * 名称を比較用キーに正規化する。
 * NFKC正規化＋空白除去＋末尾の種別語サフィックス1つ分を除去する。
 */
export function normalizeName(name) {
  let normalized = (name ?? "").normalize("NFKC").replace(/\s+/g, "");
  for (const suffix of TYPE_SUFFIXES) {
    if (normalized.endsWith(suffix) && normalized.length > suffix.length) {
      normalized = normalized.slice(0, -suffix.length);
      break;
    }
  }
  return normalized;
}

/**
 * 2点間の距離をハバーサイン近似で計算する（メートル）。
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const NEAR_DISTANCE_METERS = 500;

/**
 * 重複候補ペアを検出する。
 * (a) 同一pref かつ座標距離500m以内、または (b) 正規化名称が完全一致、のいずれかで1回だけ出力する。
 */
export function findDuplicateCandidates(facilities) {
  if (!Array.isArray(facilities)) return [];

  const pairs = [];

  for (let i = 0; i < facilities.length; i++) {
    for (let j = i + 1; j < facilities.length; j++) {
      const a = facilities[i];
      const b = facilities[j];

      const hasCoords = typeof a?.lat === "number" && typeof a?.lng === "number" && typeof b?.lat === "number" && typeof b?.lng === "number";
      const distance = hasCoords ? haversineMeters(a.lat, a.lng, b.lat, b.lng) : null;
      const samePrefNear = hasCoords && a.pref === b.pref && distance <= NEAR_DISTANCE_METERS;

      const nameA = normalizeName(a?.name);
      const nameB = normalizeName(b?.name);
      const sameNormalizedName = nameA !== "" && nameA === nameB;

      if (samePrefNear || sameNormalizedName) {
        pairs.push({ a, b, distance });
      }
    }
  }

  return pairs;
}

async function main() {
  const json = await readFile(new URL("../src/data/facilities.json", import.meta.url), "utf8");
  const facilities = JSON.parse(json);

  if (!Array.isArray(facilities) || facilities.length === 0) {
    console.log("施設が0件のためスキップします");
    return;
  }

  const pairs = findDuplicateCandidates(facilities);

  if (pairs.length === 0) {
    console.log("重複候補なし");
    return;
  }

  for (const { a, b, distance } of pairs) {
    const distanceLabel = distance === null ? "距離不明" : `${Math.round(distance)}m`;
    console.log(`${a.id} (${a.name}) <-> ${b.id} (${b.name}): ${distanceLabel}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
