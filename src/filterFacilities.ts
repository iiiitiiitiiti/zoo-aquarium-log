import type { Facility, FacilityType } from "./types";
export function filterFacilities(facilities: Facility[], query: string, type: FacilityType | "all") {
  const needle = query.trim().toLocaleLowerCase("ja-JP");
  return facilities.filter((facility) => {
    const matchesType = type === "all" || facility.type === type;
    const text = [facility.name, facility.kana, facility.pref, facility.city].join(" ").toLocaleLowerCase("ja-JP");
    return matchesType && text.includes(needle);
  });
}
