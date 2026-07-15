import { describe, expect, it } from "vitest";
import { getPinLegend, pinAppearance } from "./mapPins";
import type { Facility } from "./types";

const facility: Facility = {
  id: "custom_家族の水族館",
  name: "家族の水族館 🐠",
  kana: "かぞくのすいぞくかん",
  pref: "東京都",
  city: "台東区",
  type: "aquarium",
  lat: 35.7,
  lng: 139.8,
  url: "https://example.com",
  sourceUrls: ["https://example.com"],
  status: "open",
  lastVerifiedAt: "2026-07-15",
};

describe("pinAppearance", () => {
  it.each([
    [false, false, false, "#b84a39", "#7b2d26", []],
    [true, false, false, "#35b978", "#0f6b46", []],
    [false, true, false, "#b84a39", "#7b2d26", ["favorite"]],
    [false, false, true, "#b84a39", "#7b2d26", ["wishlist"]],
    [true, true, true, "#35b978", "#0f6b46", ["favorite", "wishlist"]],
  ])(
    "keeps visit color independent from marks (visited=%s, favorite=%s, wishlist=%s)",
    (visited, favorite, wishlist, bodyColor, borderColor, badges) => {
      const appearance = pinAppearance(
        facility,
        visited ? new Set([facility.id]) : new Set(),
        { [facility.id]: { favorite, wishlist } },
      );

      expect(appearance.bodyColor).toBe(bodyColor);
      expect(appearance.borderColor).toBe(borderColor);
      expect(appearance.badges).toEqual(badges);
    },
  );

  it("treats absent marks as empty and preserves the facility id", () => {
    expect(pinAppearance(facility, new Set(), {})).toMatchObject({
      facilityId: facility.id,
      badges: [],
    });
  });
});

describe("getPinLegend", () => {
  it("returns two body states and two labeled mark badges", () => {
    expect(getPinLegend()).toEqual([
      { key: "visited", label: "訪問済み", color: "#35b978", borderColor: "#0f6b46", symbol: undefined },
      { key: "unvisited", label: "未訪問", color: "#b84a39", borderColor: "#7b2d26", symbol: undefined },
      { key: "favorite", label: "お気に入り", color: "#2a7180", borderColor: undefined, symbol: "★" },
      { key: "wishlist", label: "行きたい", color: "#d28a20", borderColor: undefined, symbol: "♡" },
    ]);
  });
});
