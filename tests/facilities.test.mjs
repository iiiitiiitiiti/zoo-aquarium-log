import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { validateFacilities } from "../scripts/validate-facilities.mjs";
import { prefBounds, japanBounds, isInsideAnyBox } from "../scripts/pref-bounds.mjs";
import { classifyGeo } from "../scripts/check-geo.mjs";
import { findDuplicateCandidates } from "../scripts/find-duplicate-candidates.mjs";

const validFacility = {
  id: "tokyo_ueno_zoo",
  name: "恩賜上野動物園",
  kana: "おんしうえのどうぶつえん",
  pref: "東京都",
  city: "台東区",
  type: "zoo",
  lat: 35.716,
  lng: 139.772,
  url: "https://www.tokyo-zoo.net/zoo/ueno/",
  sourceUrls: ["https://www.tokyo-zoo.net/zoo/ueno/"],
  status: "open",
  lastVerifiedAt: "2026-07-13"
};

test("accepts a valid facility", () => {
  assert.deepEqual(validateFacilities([validFacility]), []);
});

test("rejects an empty facility list", () => {
  assert.match(validateFacilities([])[0], /1件以上/);
});

test("rejects duplicate IDs", () => {
  const errors = validateFacilities([validFacility, { ...validFacility }]);
  assert.ok(errors.some((error) => error.includes("IDが重複")));
});

test("rejects reserved custom IDs in the static master", () => {
  const errors = validateFacilities([{ ...validFacility, id: "custom_example" }]);
  assert.ok(errors.some((error) => error.includes("custom_")));
});

test("rejects invalid coordinates, URLs, and verification dates", () => {
  const errors = validateFacilities([{
    ...validFacility,
    lat: 91,
    lng: -181,
    url: "not-a-url",
    sourceUrls: [],
    lastVerifiedAt: "2026/07/13"
  }]);

  assert.ok(errors.some((error) => error.includes("緯度")));
  assert.ok(errors.some((error) => error.includes("経度")));
  assert.ok(errors.some((error) => error.includes("公式URL")));
  assert.ok(errors.some((error) => error.includes("一次情報URL")));
  assert.ok(errors.some((error) => error.includes("確認日")));
});

test("accepts an optional note and rejects malformed notes", () => {
  assert.deepEqual(validateFacilities([{ ...validFacility, note: "冬季（12〜3月）は定例休園。2026-07-15時点。" }]), []);
  for (const note of [123, "", "   ", "あ".repeat(501)]) {
    const errors = validateFacilities([{ ...validFacility, note }]);
    assert.ok(errors.some((error) => error.includes("補足")), `note=${JSON.stringify(note).slice(0, 20)} should be rejected`);
  }
});

test("rejects missing fields and unknown enum values", () => {
  const errors = validateFacilities([{ ...validFacility, name: "", kana: "", pref: "", city: "", type: "park", status: "unknown" }]);
  for (const field of ["名称", "読み仮名", "都道府県", "市区町村", "種別", "営業状態"]) {
    assert.ok(errors.some((error) => error.includes(field)), `${field} error is missing`);
  }
});

test("facility master contains only valid facilities", async () => {
  const json = await readFile(new URL("../src/data/facilities.json", import.meta.url), "utf8");
  const facilities = JSON.parse(json);
  assert.ok(facilities.length >= 20, `expected at least 20 facilities, got ${facilities.length}`);
  assert.deepEqual(validateFacilities(facilities), []);
});

// prefectures.ts を二重管理しないため、県庁所在地座標はテキストとして読み正規表現で抽出する
async function loadCapitals() {
  const source = await readFile(new URL("../src/prefectures.ts", import.meta.url), "utf8");
  const pattern = /\{ name: "([^"]+)", capital: "[^"]+", lat: ([\d.]+), lng: ([\d.]+) \}/g;
  const capitals = new Map();
  for (const match of source.matchAll(pattern)) {
    capitals.set(match[1], { lat: Number(match[2]), lng: Number(match[3]) });
  }
  return capitals;
}

test("prefBounds covers exactly 47 prefectures with well-formed boxes", () => {
  const keys = Object.keys(prefBounds);
  assert.equal(keys.length, 47, `expected 47 prefectures, got ${keys.length}`);
  for (const [pref, entry] of Object.entries(prefBounds)) {
    assert.ok(Array.isArray(entry.boxes) && entry.boxes.length >= 1, `${pref}: boxes missing`);
    for (const box of entry.boxes) {
      assert.ok(box.minLat < box.maxLat, `${pref}: minLat should be < maxLat`);
      assert.ok(box.minLng < box.maxLng, `${pref}: minLng should be < maxLng`);
    }
  }
});

test("prefBounds boxes contain their prefectural capital", async () => {
  const capitals = await loadCapitals();
  assert.ok(capitals.size === 47, `expected 47 capitals parsed from prefectures.ts, got ${capitals.size}`);
  for (const [pref, coords] of capitals) {
    const entry = prefBounds[pref];
    assert.ok(entry, `${pref}: missing from prefBounds`);
    const inside = entry.boxes.some(
      (box) => coords.lat >= box.minLat && coords.lat <= box.maxLat && coords.lng >= box.minLng && coords.lng <= box.maxLng
    );
    assert.ok(inside, `${pref}: capital (${coords.lat}, ${coords.lng}) is outside all boxes`);
  }
});

test("classifyGeo includes representative remote islands (inside or manual-review)", () => {
  const islands = [
    { name: "父島", pref: "東京都", lat: 27.09, lng: 142.19 },
    { name: "宮古島", pref: "沖縄県", lat: 24.79, lng: 125.28 },
    { name: "隠岐・島後", pref: "島根県", lat: 36.21, lng: 133.32 },
    { name: "対馬", pref: "長崎県", lat: 34.2, lng: 129.29 },
    { name: "奄美大島", pref: "鹿児島県", lat: 28.38, lng: 129.49 },
    { name: "八丈島", pref: "東京都", lat: 33.11, lng: 139.79 },
  ];

  for (const island of islands) {
    const category = classifyGeo(island, prefBounds);
    assert.ok(
      category === "inside" || category === "manual-review",
      `${island.name}: expected inside/manual-review, got ${category}`
    );
  }
});

test("classifyGeo returns unknown-pref for an unrecognized prefecture name", () => {
  assert.equal(classifyGeo({ pref: "存在しない県", lat: 35, lng: 135 }, prefBounds), "unknown-pref");
});

test("japanBounds accepts valid Japan coordinates and rejects lat/lng swaps", () => {
  assert.ok(isInsideAnyBox(35.7, 139.7, japanBounds), "Tokyo coordinates should be inside japanBounds");

  const errors = validateFacilities([{ ...validFacility, lat: 139.7, lng: 35.7 }]);
  assert.ok(errors.some((error) => error.includes("日本の範囲外")));
});

test("findDuplicateCandidates detects an obvious duplicate pair (name variant, close coordinates)", () => {
  const a = { ...validFacility, id: "tokyo_ueno_zoo", name: "上野動物園", lat: 35.716, lng: 139.772 };
  const b = { ...validFacility, id: "tokyo_ueno_zoo_2", name: "恩賜上野動物園", lat: 35.7161, lng: 139.7721 };
  const pairs = findDuplicateCandidates([a, b]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].a.id, "tokyo_ueno_zoo");
  assert.equal(pairs[0].b.id, "tokyo_ueno_zoo_2");
});

test("findDuplicateCandidates does not flag unrelated facilities", () => {
  const a = { ...validFacility, id: "tokyo_ueno_zoo", name: "上野動物園", pref: "東京都", lat: 35.716, lng: 139.772 };
  const b = { ...validFacility, id: "hokkaido_asahiyama_zoo", name: "旭山動物園", pref: "北海道", lat: 43.7684, lng: 142.4804 };
  assert.deepEqual(findDuplicateCandidates([a, b]), []);
});
