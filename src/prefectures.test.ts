import { describe, expect, it } from "vitest";
import { prefectures } from "./prefectures";

describe("prefectures", () => {
  it("47都道府県を重複なく持つ", () => {
    expect(prefectures).toHaveLength(47);
    expect(new Set(prefectures.map((item) => item.name)).size).toBe(47);
  });

  it("座標が日本の範囲内にある", () => {
    prefectures.forEach(({ lat, lng }) => {
      expect(lat).toBeGreaterThanOrEqual(24);
      expect(lat).toBeLessThanOrEqual(46);
      expect(lng).toBeGreaterThanOrEqual(122);
      expect(lng).toBeLessThanOrEqual(146);
    });
  });
});
