import { describe, expect, it } from "vitest";
import { buildRouteHash, parseRouteHash, routesEqual, type Route } from "./route";

describe("parseRouteHash", () => {
  it("空・不明なハッシュは一覧にフォールバックする", () => {
    expect(parseRouteHash("")).toEqual({ view: "list" });
    expect(parseRouteHash("#")).toEqual({ view: "list" });
    expect(parseRouteHash("#unknown")).toEqual({ view: "list" });
    expect(parseRouteHash("#facility/")).toEqual({ view: "list" });
    expect(parseRouteHash("#edit/")).toEqual({ view: "list" });
  });

  it("各画面のハッシュを解釈する", () => {
    expect(parseRouteHash("#map")).toEqual({ view: "map" });
    expect(parseRouteHash("#map/tokyo_ueno_zoo")).toEqual({ view: "map", focusFacilityId: "tokyo_ueno_zoo" });
    expect(parseRouteHash("#stats")).toEqual({ view: "stats" });
    expect(parseRouteHash("#facility/tokyo_ueno_zoo")).toEqual({ view: "facility", facilityId: "tokyo_ueno_zoo" });
    expect(parseRouteHash("#add")).toEqual({ view: "addFacility" });
    expect(parseRouteHash("#edit/custom_abc")).toEqual({ view: "editFacility", facilityId: "custom_abc" });
  });

  it("統計画面内アンカーは統計画面として扱う", () => {
    expect(parseRouteHash("#stats-type")).toEqual({ view: "stats" });
    expect(parseRouteHash("#stats-pref")).toEqual({ view: "stats" });
    expect(parseRouteHash("#stats-monthly")).toEqual({ view: "stats" });
  });

  it("URLエンコードされたIDを復号する", () => {
    expect(parseRouteHash("#facility/custom%20id")).toEqual({ view: "facility", facilityId: "custom id" });
  });
});

describe("buildRouteHash", () => {
  it("各画面のハッシュを生成し、parse と往復一致する", () => {
    const routes: Route[] = [
      { view: "list" },
      { view: "map" },
      { view: "map", focusFacilityId: "tokyo_ueno_zoo" },
      { view: "stats" },
      { view: "facility", facilityId: "tokyo_ueno_zoo" },
      { view: "addFacility" },
      { view: "editFacility", facilityId: "custom_abc" },
    ];
    for (const route of routes) {
      expect(parseRouteHash(buildRouteHash(route))).toEqual(route);
    }
  });

  it("一覧は空文字（ハッシュなし）になる", () => {
    expect(buildRouteHash({ view: "list" })).toBe("");
  });
});

describe("routesEqual", () => {
  it("統計アンカー由来のルートは #stats と等価", () => {
    expect(routesEqual(parseRouteHash("#stats-type"), { view: "stats" })).toBe(true);
  });

  it("異なる施設IDは等価でない", () => {
    expect(routesEqual({ view: "facility", facilityId: "a" }, { view: "facility", facilityId: "b" })).toBe(false);
  });
});
