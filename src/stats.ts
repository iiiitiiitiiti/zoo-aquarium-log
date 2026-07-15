import { prefectures } from "./prefectures";
import type { Facility, FacilityType } from "./types";
import type { Visit } from "./visits";

export interface StatsCount {
  visited: number;
  total: number;
}

export interface StatsTypeRow extends StatsCount {
  type: FacilityType;
}

export interface StatsPrefectureRow extends StatsCount {
  pref: string;
}

export interface StatsMonthlyRow {
  month: string;
  count: number;
}

export interface StatsModel {
  overall: StatsCount & { percent: number };
  byType: StatsTypeRow[];
  byPref: StatsPrefectureRow[];
  monthly: StatsMonthlyRow[];
}

const typeOrder: FacilityType[] = ["zoo", "aquarium", "both", "other"];

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthIndex(month: string) {
  const [year, value] = month.split("-").map(Number);
  return year * 12 + value - 1;
}

function monthFromIndex(index: number) {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function buildMonthly(visits: Visit[], now: Date): StatsMonthlyRow[] {
  if (visits.length === 0) return [];

  const counts = new Map<string, number>();
  for (const visit of visits) {
    const month = visit.date.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }

  const months = [...counts.keys()];
  const start = Math.min(...months.map(monthIndex));
  const end = Math.max(monthIndex(monthKey(now)), ...months.map(monthIndex));
  return Array.from({ length: end - start + 1 }, (_, offset) => {
    const month = monthFromIndex(start + offset);
    return { month, count: counts.get(month) ?? 0 };
  });
}

export function buildStats(facilities: Facility[], visits: Visit[], now = new Date()): StatsModel {
  const eligibleFacilities = facilities.filter((facility) => facility.status !== "closed");
  const visitedIds = new Set(visits.map((visit) => visit.facilityId));
  const overallVisited = eligibleFacilities.filter((facility) => visitedIds.has(facility.id)).length;
  const overallTotal = eligibleFacilities.length;

  const byType = typeOrder
    .map((type) => {
      const typeFacilities = eligibleFacilities.filter((facility) => facility.type === type);
      return {
        type,
        visited: typeFacilities.filter((facility) => visitedIds.has(facility.id)).length,
        total: typeFacilities.length,
      };
    })
    .filter((row) => row.total > 0);

  const knownPrefectures = new Set(prefectures.map((prefecture) => prefecture.name));
  const prefRows = new Map<string, StatsPrefectureRow>();
  for (const prefecture of prefectures) {
    prefRows.set(prefecture.name, { pref: prefecture.name, visited: 0, total: 0 });
  }
  for (const facility of eligibleFacilities) {
    const pref = knownPrefectures.has(facility.pref) ? facility.pref : "その他";
    const row = prefRows.get(pref) ?? { pref, visited: 0, total: 0 };
    row.total += 1;
    if (visitedIds.has(facility.id)) row.visited += 1;
    prefRows.set(pref, row);
  }
  const byPref = [...prefRows.values()].filter((row) => row.total > 0);

  return {
    overall: {
      visited: overallVisited,
      total: overallTotal,
      percent: overallTotal === 0 ? 0 : Math.floor((overallVisited / overallTotal) * 100),
    },
    byType,
    byPref,
    monthly: buildMonthly(visits, now),
  };
}
