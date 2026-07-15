export type Route =
  | { view: "list" }
  | { view: "map"; focusFacilityId?: string }
  | { view: "stats" }
  | { view: "facility"; facilityId: string }
  | { view: "addFacility" }
  | { view: "editFacility"; facilityId: string };

// URL ハッシュと画面の対応。統計画面内のアンカー（#stats-type 等）は
// 統計画面のまま扱い、未知のハッシュは一覧へフォールバックする。
export function parseRouteHash(hash: string): Route {
  const path = hash.replace(/^#/, "");
  if (path === "map") return { view: "map" };
  if (path.startsWith("map/")) {
    const focusFacilityId = decodeURIComponent(path.slice("map/".length));
    return focusFacilityId ? { view: "map", focusFacilityId } : { view: "map" };
  }
  if (path === "stats" || path.startsWith("stats-")) return { view: "stats" };
  if (path.startsWith("facility/")) {
    const facilityId = decodeURIComponent(path.slice("facility/".length));
    return facilityId ? { view: "facility", facilityId } : { view: "list" };
  }
  if (path === "add") return { view: "addFacility" };
  if (path.startsWith("edit/")) {
    const facilityId = decodeURIComponent(path.slice("edit/".length));
    return facilityId ? { view: "editFacility", facilityId } : { view: "list" };
  }
  return { view: "list" };
}

export function buildRouteHash(route: Route): string {
  switch (route.view) {
    case "map":
      return route.focusFacilityId ? `#map/${encodeURIComponent(route.focusFacilityId)}` : "#map";
    case "stats":
      return "#stats";
    case "facility":
      return `#facility/${encodeURIComponent(route.facilityId)}`;
    case "addFacility":
      return "#add";
    case "editFacility":
      return `#edit/${encodeURIComponent(route.facilityId)}`;
    default:
      return "";
  }
}

export function routesEqual(a: Route, b: Route): boolean {
  return buildRouteHash(a) === buildRouteHash(b);
}
