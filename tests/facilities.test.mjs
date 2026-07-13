import test from "node:test";
import assert from "node:assert/strict";

import { validateFacilities } from "../scripts/validate-facilities.mjs";

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
