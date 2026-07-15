import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "./map.css";
import { getPinLegend, pinAppearance, type PinBadge } from "./mapPins";
import type { MarkMap } from "./marks";
import type { Facility, FacilityType } from "./types";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors";
const statusLabels: Record<Facility["status"], string> = {
  open: "営業中",
  suspended: "休園中",
  closed: "閉園済み",
};
const typeLabels: Record<FacilityType, string> = {
  zoo: "動物園",
  aquarium: "水族館",
  both: "複合施設",
  other: "その他",
};
const badgeSymbols: Record<PinBadge, string> = {
  favorite: "★",
  wishlist: "♡",
};
type FacilityMarker = L.Marker & { facilityId?: string };

function appendTextRow(parent: HTMLElement, label: string, value: string) {
  const row = document.createElement("p");
  const labelElement = document.createElement("strong");
  labelElement.textContent = `${label}: `;
  row.append(labelElement, document.createTextNode(value));
  parent.append(row);
}

export function createFacilityPopup(
  facility: Facility,
  visitedIds: ReadonlySet<string>,
  marks: MarkMap,
  onSelectFacility: (facility: Facility) => void,
): HTMLElement {
  const popup = document.createElement("div");
  popup.className = "map-popup";

  const name = document.createElement("strong");
  name.className = "map-popup-name";
  name.textContent = facility.name;
  popup.append(name);

  appendTextRow(popup, "種別", typeLabels[facility.type]);
  appendTextRow(popup, "営業状態", statusLabels[facility.status]);
  appendTextRow(popup, "訪問状況", visitedIds.has(facility.id) ? "訪問済み" : "未訪問");

  const mark = marks[facility.id];
  if (mark?.favorite === true) appendTextRow(popup, "マーク", "お気に入り");
  if (mark?.wishlist === true) appendTextRow(popup, "マーク", "行きたい");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "map-popup-detail";
  button.textContent = "詳細を見る";
  L.DomEvent.on(button, "click", () => onSelectFacility(facility));
  popup.append(button);
  return popup;
}

function createPinHtml(appearance: ReturnType<typeof pinAppearance>) {
  const badges = appearance.badges
    .map((badge) => `<span class="map-pin-badge ${badge}">${badgeSymbols[badge]}</span>`)
    .join("");
  return `<span class="map-pin-body" style="background-color:${appearance.bodyColor};border-color:${appearance.borderColor}"></span>${badges}`;
}

export default function MapPanel({
  shown,
  visitedIds,
  marks,
  focusedFacilityId,
  onBack,
  onSelectFacility,
}: {
  shown: Facility[];
  visitedIds: ReadonlySet<string>;
  marks: MarkMap;
  focusedFacilityId?: string;
  onBack: () => void;
  onSelectFacility: (facility: Facility) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | undefined>(undefined);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | undefined>(undefined);
  const hasFitInitialViewRef = useRef(false);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const map = L.map(container, { zoomControl: false });
    const clusterGroup = L.markerClusterGroup({
      disableClusteringAtZoom: 15,
      iconCreateFunction: (cluster) => L.divIcon({
        className: "map-cluster-icon",
        html: `<span>${cluster.getChildCount()}</span>`,
        iconSize: [38, 38],
      }),
    });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);
    clusterGroup.addTo(map);
    mapRef.current = map;
    clusterGroupRef.current = clusterGroup;
    map.invalidateSize();

    const invalidateSize = () => map.invalidateSize();
    const visualViewport = window.visualViewport;
    window.addEventListener("resize", invalidateSize);
    visualViewport?.addEventListener("resize", invalidateSize);

    return () => {
      window.removeEventListener("resize", invalidateSize);
      visualViewport?.removeEventListener("resize", invalidateSize);
      clusterGroupRef.current = undefined;
      mapRef.current = undefined;
      hasFitInitialViewRef.current = false;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const clusterGroup = clusterGroupRef.current;
    if (!map || !clusterGroup) return;

    const openFacilityId = clusterGroup.getLayers()
      .map((layer) => layer as FacilityMarker)
      .find((marker) => marker.isPopupOpen() && marker.facilityId)
      ?.facilityId;
    const focusedFacility = focusedFacilityId
      ? shown.find((facility) => facility.id === focusedFacilityId)
      : undefined;
    clusterGroup.clearLayers();
    const markers = shown.map((facility) => {
      const appearance = pinAppearance(facility, visitedIds, marks);
      const icon = L.divIcon({
        className: "map-pin-icon",
        html: createPinHtml(appearance),
        iconSize: [42, 42],
        iconAnchor: [21, 21],
        popupAnchor: [0, -21],
      });
      const popup = createFacilityPopup(facility, visitedIds, marks, onSelectFacility);
      const marker = L.marker([facility.lat, facility.lng], { icon }).bindPopup(popup) as FacilityMarker;
      marker.facilityId = facility.id;
      return marker;
    });
    clusterGroup.addLayers(markers);
    const requestedOpenFacilityId = focusedFacility?.id ?? openFacilityId;
    if (requestedOpenFacilityId) {
      markers.find((marker) => marker.facilityId === requestedOpenFacilityId)?.openPopup();
    }

    if (hasFitInitialViewRef.current) return;
    if (focusedFacility) {
      map.setView([focusedFacility.lat, focusedFacility.lng], 12);
    } else if (shown.length === 1) {
      map.setView([shown[0].lat, shown[0].lng], 12);
    } else if (shown.length > 1) {
      map.fitBounds(
        L.latLngBounds(shown.map((facility) => [facility.lat, facility.lng] as L.LatLngTuple)),
        { padding: [24, 24] },
      );
    } else {
      map.setView([36.5, 137.5], 5);
    }
    hasFitInitialViewRef.current = true;
  }, [focusedFacilityId, marks, onSelectFacility, shown, visitedIds]);

  const legend = getPinLegend();

  return (
    <main className="app-shell map-shell">
      <header className="map-header">
        <div className="map-header-top">
          <button className="back-button" type="button" onClick={onBack}>← 施設一覧</button>
          <span className="map-count">{shown.length}施設を表示</span>
        </div>
        <h1>施設マップ</h1>
        <ul className="map-legend" aria-label="地図の凡例">
          {legend.map((item) => (
            <li key={item.key}>
              <span
                className={`map-legend-chip ${item.symbol ? "is-badge" : ""}`}
                style={{ backgroundColor: item.color, borderColor: item.borderColor ?? item.color }}
                aria-hidden="true"
              >{item.symbol}</span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </header>
      <div className="map-content">
        <div ref={mapContainerRef} className="map-canvas" aria-label="施設マップ" />
        {shown.length === 0 && <p className="map-empty" role="status">地図に表示する施設がありません</p>}
      </div>
    </main>
  );
}
