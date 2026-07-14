import { Timestamp } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import { buildExport, buildExportFilename } from "./buildExport";
import type { Facility } from "./types";
import type { Visit } from "./visits";

const customFacility: Facility = {
  id: "custom_zoo",
  name: "家族の動物園",
  kana: "かぞくのどうぶつえん",
  pref: "東京都",
  city: "台東区",
  type: "zoo",
  lat: 35.7,
  lng: 139.8,
  url: "https://example.com/zoo",
  sourceUrls: ["https://example.com/zoo"],
  status: "open",
  lastVerifiedAt: "2026-07-14",
};

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: "visit-1",
    facilityId: "deleted_custom_facility",
    date: "2026-07-01",
    createdAt: Timestamp.fromDate(new Date("2026-07-01T01:02:03.000Z")),
    updatedAt: Timestamp.fromDate(new Date("2026-07-02T01:02:03.000Z")),
    ...overrides,
  };
}

describe("buildExport", () => {
  const now = new Date("2026-07-14T12:34:56.000Z");

  it("converts visits, marks, custom facilities, and timestamps into the export schema", () => {
    const result = buildExport(
      [visit({ rating: 5, memo: "楽しかった", visitor: "家族", photoPath: "visits/visit-1/photo.webp" })],
      { deleted_custom_facility: { wishlist: true, favorite: false } },
      [customFacility],
      now,
    );

    expect(result).toEqual({
      schemaVersion: 1,
      exportedAt: "2026-07-14T12:34:56.000Z",
      counts: { visits: 1, marks: 1, customFacilities: 1 },
      visits: [{
        id: "visit-1",
        facilityId: "deleted_custom_facility",
        date: "2026-07-01",
        rating: 5,
        memo: "楽しかった",
        visitor: "家族",
        photoPath: "visits/visit-1/photo.webp",
        createdAt: "2026-07-01T01:02:03.000Z",
        updatedAt: "2026-07-02T01:02:03.000Z",
      }],
      marks: [{ facilityId: "deleted_custom_facility", wishlist: true, favorite: false }],
      customFacilities: [customFacility],
    });
  });

  it("omits undefined optional fields and keeps missing timestamps as null", () => {
    const result = buildExport([{ ...visit(), createdAt: null, updatedAt: null } as unknown as Visit], {}, [], now);

    expect(result.visits[0]).toEqual({
      id: "visit-1",
      facilityId: "deleted_custom_facility",
      date: "2026-07-01",
      createdAt: null,
      updatedAt: null,
    });
    expect(JSON.stringify(result)).not.toContain("undefined");
  });

  it("sorts without mutating input arrays and does not filter orphan records", () => {
    const first = visit({ id: "visit-b", date: "2026-07-02" });
    const second = visit({ id: "visit-a", date: "2026-07-01" });
    const visits = [first, second];
    const customFacilities = [{ ...customFacility, id: "custom_b" }, { ...customFacility, id: "custom_a" }];
    const originalVisits = [...visits];
    const originalCustomFacilities = [...customFacilities];

    const result = buildExport(
      visits,
      {
        orphan_b: { wishlist: false, favorite: true },
        orphan_a: { wishlist: true, favorite: false },
      },
      customFacilities,
      now,
    );

    expect(result.visits.map((item) => item.id)).toEqual(["visit-a", "visit-b"]);
    expect(result.marks.map((item) => item.facilityId)).toEqual(["orphan_a", "orphan_b"]);
    expect(result.customFacilities.map((item) => item.id)).toEqual(["custom_a", "custom_b"]);
    expect(visits).toEqual(originalVisits);
    expect(customFacilities).toEqual(originalCustomFacilities);
  });

  it("produces the same ordered data regardless of input order", () => {
    const dataA = buildExport(
      [visit({ id: "visit-b", date: "2026-07-02" }), visit({ id: "visit-a", date: "2026-07-01" })],
      { mark_b: { wishlist: false, favorite: true }, mark_a: { wishlist: true, favorite: false } },
      [{ ...customFacility, id: "custom_b" }, { ...customFacility, id: "custom_a" }],
      now,
    );
    const dataB = buildExport(
      [visit({ id: "visit-a", date: "2026-07-01" }), visit({ id: "visit-b", date: "2026-07-02" })],
      { mark_a: { wishlist: true, favorite: false }, mark_b: { wishlist: false, favorite: true } },
      [{ ...customFacility, id: "custom_a" }, { ...customFacility, id: "custom_b" }],
      now,
    );

    expect(dataA).toEqual(dataB);
  });

  it("supports empty exports and uses the local date in filenames", () => {
    expect(buildExport([], {}, [], now)).toMatchObject({
      counts: { visits: 0, marks: 0, customFacilities: 0 },
      visits: [],
      marks: [],
      customFacilities: [],
    });
    expect(buildExportFilename(new Date(2026, 6, 14, 12))).toBe("zoo-aquarium-log-2026-07-14.json");
  });
});
