import type { Facility, FacilityType } from "./types";
export function filterFacilities(facilities: Facility[], query: string, type: FacilityType | "all", prefecture: string = "all", status: Facility["status"] | "all" = "all") {
  const needle = query.trim().toLocaleLowerCase("ja-JP");
  return facilities.filter((facility) => {
    const matchesType = type === "all" || facility.type === type;
    const matchesPrefecture = prefecture === "all" || facility.pref === prefecture;
    const matchesStatus = status === "all" || facility.status === status;
    const text = [facility.name, facility.kana, facility.pref, facility.city].join(" ").toLocaleLowerCase("ja-JP");
    return matchesType && matchesPrefecture && matchesStatus && text.includes(needle);
  });
}
