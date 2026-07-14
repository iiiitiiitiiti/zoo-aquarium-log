import { readFile } from "node:fs/promises";

import { prefBounds, isInsideBox } from "./pref-bounds.mjs";

const MANUAL_REVIEW_MARGIN = 0.05;

/**
 * 施設1件を都道府県バウンディングボックスに対して3値判定する（警告用途）。
 * - inside: pref の boxes のいずれかに入る
 * - outside: どのボックスにも入らない（要人手確認）
 * - unknown-pref: pref 名が prefBounds に無い
 * さらに inside のうち、ボックス境界から MANUAL_REVIEW_MARGIN 度以内なら manual-review。
 */
export function classifyGeo(facility, bounds) {
  const entry = bounds[facility?.pref];
  if (!entry) return "unknown-pref";

  const { lat, lng } = facility;
  if (typeof lat !== "number" || typeof lng !== "number") return "outside";

  let inside = false;
  let nearBoundary = false;

  for (const box of entry.boxes) {
    if (isInsideBox(lat, lng, box)) {
      inside = true;
      const distToEdge = Math.min(
        lat - box.minLat,
        box.maxLat - lat,
        lng - box.minLng,
        box.maxLng - lng
      );
      if (distToEdge <= MANUAL_REVIEW_MARGIN) nearBoundary = true;
    }
  }

  if (!inside) return "outside";
  return nearBoundary ? "manual-review" : "inside";
}

async function main() {
  const json = await readFile(new URL("../src/data/facilities.json", import.meta.url), "utf8");
  const facilities = JSON.parse(json);

  if (!Array.isArray(facilities) || facilities.length === 0) {
    console.log("施設が0件のためスキップします");
    return;
  }

  const results = { inside: [], outside: [], "unknown-pref": [], "manual-review": [] };

  for (const facility of facilities) {
    const category = classifyGeo(facility, prefBounds);
    results[category].push(facility);
  }

  const flagged = [...results.outside, ...results["unknown-pref"], ...results["manual-review"]];

  if (flagged.length === 0) {
    console.log("全件 inside");
    console.log(`inside: ${results.inside.length}件`);
    return;
  }

  console.log(`inside: ${results.inside.length}件`);

  for (const category of ["outside", "unknown-pref", "manual-review"]) {
    for (const facility of results[category]) {
      console.log(`${category}: ${facility.id} ${facility.name} ${facility.pref} (${facility.lat}, ${facility.lng})`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
