import type { MarkMap } from "./marks";
import type { Facility } from "./types";

export type PinBadge = "favorite" | "wishlist";

export interface PinAppearance {
  facilityId: string;
  bodyColor: string;
  borderColor: string;
  badges: PinBadge[];
}

export interface PinLegendItem {
  key: "visited" | "unvisited" | PinBadge;
  label: string;
  color: string;
  borderColor?: string;
  symbol?: "★" | "♡";
}

const VISITED_COLOR = "#35b978";
const UNVISITED_COLOR = "#b84a39";
const UNVISITED_BORDER_COLOR = "#7b2d26";
const VISITED_BORDER_COLOR = "#0f6b46";

export function pinAppearance(
  facility: Facility,
  visitedIds: ReadonlySet<string>,
  marks: MarkMap,
): PinAppearance {
  const isVisited = visitedIds.has(facility.id);
  const mark = marks[facility.id];
  const badges: PinBadge[] = [];
  if (mark?.favorite === true) badges.push("favorite");
  if (mark?.wishlist === true) badges.push("wishlist");

  return {
    facilityId: facility.id,
    bodyColor: isVisited ? VISITED_COLOR : UNVISITED_COLOR,
    borderColor: isVisited ? VISITED_BORDER_COLOR : UNVISITED_BORDER_COLOR,
    badges,
  };
}

export function getPinLegend(): PinLegendItem[] {
  return [
    { key: "visited", label: "訪問済み", color: VISITED_COLOR, borderColor: VISITED_BORDER_COLOR },
    { key: "unvisited", label: "未訪問", color: UNVISITED_COLOR, borderColor: UNVISITED_BORDER_COLOR },
    { key: "favorite", label: "お気に入り", color: "#2a7180", symbol: "★" },
    { key: "wishlist", label: "行きたい", color: "#d28a20", symbol: "♡" },
  ];
}
