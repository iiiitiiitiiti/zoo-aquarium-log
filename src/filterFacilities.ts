import type { Facility, FacilityType } from "./types";
export function filterFacilities(facilities: Facility[], query: string, type: FacilityType | "all", prefecture: string = "all") {
  const needle = query.trim().toLocaleLowerCase("ja-JP");
  return facilities.filter((facility) => {
    const matchesType = type === "all" || facility.type === type;
    const matchesPrefecture = prefecture === "all" || facility.pref === prefecture;
    const text = [facility.name, facility.kana, facility.pref, facility.city].join(" ").toLocaleLowerCase("ja-JP");
    return matchesType && matchesPrefecture && text.includes(needle);
  });
}
