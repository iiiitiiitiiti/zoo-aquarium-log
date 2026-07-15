import { describe, expect, it } from "vitest";
import type { Facility, FacilityType } from "./types";
import type { Visit } from "./visits";
import { buildStats } from "./stats";

function facility(
  id: string,
  type: FacilityType,
  pref: string,
  status: Facility["status"] = "open",
): Facility {
  return {
    id,
    name: id,
    kana: id,
    pref,
    city: "市",
    type,
    lat: 35,
    lng: 139,
    url: "https://example.com",
    sourceUrls: ["https://example.com"],
    status,
    lastVerifiedAt: "2026-07-15",
  };
}

function visit(id: string, facilityId: string, date: string): Visit {
  return { id, facilityId, date } as Visit;
}

describe("buildStats", () => {
  it("excludes closed facilities, includes suspended facilities, and counts visits uniquely", () => {
    const facilities = [
      facility("zoo-visited", "zoo", "北海道"),
      facility("zoo-unvisited", "zoo", "北海道"),
      facility("aquarium-visited", "aquarium", "東京都", "suspended"),
      facility("closed-visited", "aquarium", "東京都", "closed"),
    ];

    const result = buildStats(
      facilities,
      [
        visit("visit-a", "zoo-visited", "2026-01-01"),
        visit("visit-b", "zoo-visited", "2026-02-01"),
        visit("visit-c", "aquarium-visited", "2026-02-02"),
        visit("visit-d", "closed-visited", "2026-02-03"),
      ],
      new Date(2026, 1, 15),
    );

    expect(result.overall).toEqual({ visited: 2, total: 3, percent: 66 });
    expect(result.byType).toEqual([
      { type: "zoo", visited: 1, total: 2 },
      { type: "aquarium", visited: 1, total: 1 },
    ]);
    expect(result.byPref).toEqual([
      { pref: "北海道", visited: 1, total: 2 },
      { pref: "東京都", visited: 1, total: 1 },
    ]);
  });

  it("keeps dangling visit records in the monthly record count but not in facility completion", () => {
    const result = buildStats(
      [facility("known", "other", "東京都")],
      [visit("visit-known", "known", "2026-03-01"), visit("visit-dangling", "deleted", "2026-03-15")],
      new Date(2026, 2, 20),
    );

    expect(result.overall).toEqual({ visited: 1, total: 1, percent: 100 });
    expect(result.monthly).toEqual([{ month: "2026-03", count: 2 }]);
  });

  it("fills missing months across years and extends through the latest future visit", () => {
    const result = buildStats(
      [facility("known", "zoo", "東京都")],
      [visit("visit-old", "known", "2025-12-20"), visit("visit-future", "known", "2026-04-01")],
      new Date(2026, 1, 10),
    );

    expect(result.monthly).toEqual([
      { month: "2025-12", count: 1 },
      { month: "2026-01", count: 0 },
      { month: "2026-02", count: 0 },
      { month: "2026-03", count: 0 },
      { month: "2026-04", count: 1 },
    ]);
  });

  it("returns zero percent, omits empty groups, and preserves unknown prefectures as other", () => {
    const result = buildStats(
      [
        facility("closed", "zoo", "北海道", "closed"),
        facility("unknown-pref", "other", "海外"),
      ],
      [],
      new Date(2026, 6, 15),
    );

    expect(result.overall).toEqual({ visited: 0, total: 1, percent: 0 });
    expect(result.byType).toEqual([{ type: "other", visited: 0, total: 1 }]);
    expect(result.byPref).toEqual([{ pref: "その他", visited: 0, total: 1 }]);
    expect(result.monthly).toEqual([]);
  });

  it("returns an empty model when every facility is closed", () => {
    const result = buildStats(
      [facility("closed", "zoo", "北海道", "closed")],
      [visit("visit-closed", "closed", "2026-07-01")],
      new Date(2026, 6, 15),
    );

    expect(result.overall).toEqual({ visited: 0, total: 0, percent: 0 });
    expect(result.byType).toEqual([]);
    expect(result.byPref).toEqual([]);
    expect(result.monthly).toEqual([{ month: "2026-07", count: 1 }]);
  });
});
