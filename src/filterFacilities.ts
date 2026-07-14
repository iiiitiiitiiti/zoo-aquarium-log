import type { Facility, FacilityType } from "./types";
import type { MarkMap } from "./marks";

export type VisitStatusFilter = "all" | "visited" | "unvisited" | "wishlist" | "favorite";
export interface VisitStatusQuery {
  filter: VisitStatusFilter;
  visitedIds: ReadonlySet<string>;
  marks: MarkMap;
}

export function filterFacilities(
  facilities: Facility[],
  query: string,
  type: FacilityType | "all",
  prefecture: string = "all",
  status: Facility["status"] | "all" = "all",
  visitStatus: VisitStatusQuery = { filter: "all", visitedIds: new Set(), marks: {} },
) {
  const needle = query.trim().toLocaleLowerCase("ja-JP");
  return facilities.filter((facility) => {
    const matchesType = type === "all" || facility.type === type;
    const matchesPrefecture = prefecture === "all" || facility.pref === prefecture;
    const matchesStatus = status === "all" || facility.status === status;
    const mark = visitStatus.marks[facility.id];
    const isVisited = visitStatus.visitedIds.has(facility.id);
    const matchesVisitStatus = visitStatus.filter === "all"
      || (visitStatus.filter === "visited" && isVisited)
      || (visitStatus.filter === "unvisited" && !isVisited)
      || (visitStatus.filter === "wishlist" && mark?.wishlist === true)
      || (visitStatus.filter === "favorite" && mark?.favorite === true);
    const text = [facility.name, facility.kana, facility.pref, facility.city].join(" ").toLocaleLowerCase("ja-JP");
    return matchesType && matchesPrefecture && matchesStatus && matchesVisitStatus && text.includes(needle);
  });
}
