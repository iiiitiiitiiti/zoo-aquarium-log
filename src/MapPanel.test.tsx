import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MapPanel, { createFacilityPopup } from "./MapPanel";
import type { Facility } from "./types";

const leafletMocks = vi.hoisted(() => {
  const map = {
    fitBounds: vi.fn().mockReturnThis(),
    invalidateSize: vi.fn(),
    on: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    setView: vi.fn().mockReturnThis(),
  };
  const tileLayer = { addTo: vi.fn().mockReturnThis() };
  const clusterGroup = {
    addLayers: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    clearLayers: vi.fn().mockReturnThis(),
    getLayers: vi.fn((): unknown[] => []),
  };
  const marker = {
    bindPopup: vi.fn().mockReturnThis(),
    isPopupOpen: vi.fn(() => true),
    openPopup: vi.fn().mockReturnThis(),
  };
  return {
    map,
    tileLayer,
    clusterGroup,
    marker,
    leaflet: {
      DomEvent: { on: vi.fn((element: HTMLElement, _event: string, handler: () => void) => element.addEventListener("click", handler)) },
      divIcon: vi.fn((options) => options),
      latLngBounds: vi.fn((bounds) => bounds),
      map: vi.fn(() => map),
      marker: vi.fn(() => marker),
      markerClusterGroup: vi.fn(() => clusterGroup),
      tileLayer: vi.fn(() => tileLayer),
    },
  };
});

vi.mock("leaflet", () => leafletMocks.leaflet);
vi.mock("leaflet.markercluster", () => ({}));

const facilities: Facility[] = [
  {
    id: "tokyo-zoo",
    name: "恩賜上野動物園",
    kana: "おんしうえのどうぶつえん",
    pref: "東京都",
    city: "台東区",
    type: "zoo",
    lat: 35.716,
    lng: 139.771,
    url: "https://example.com/zoo",
    sourceUrls: ["https://example.com/zoo"],
    status: "open",
    lastVerifiedAt: "2026-07-15",
  },
];

describe("MapPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the map heading, count, legend labels, and back button", () => {
    render(<MapPanel shown={facilities} visitedIds={new Set()} marks={{}} onBack={vi.fn()} onSelectFacility={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "施設マップ" })).toBeInTheDocument();
    expect(screen.getByText("1施設を表示")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "← 施設一覧" })).toBeInTheDocument();
    expect(screen.getByText("訪問済み")).toBeInTheDocument();
    expect(screen.getByText("未訪問")).toBeInTheDocument();
    expect(screen.getByText("お気に入り")).toBeInTheDocument();
    expect(screen.getByText("行きたい")).toBeInTheDocument();
    expect(leafletMocks.leaflet.map).toHaveBeenCalledOnce();
    expect(leafletMocks.leaflet.markerClusterGroup).toHaveBeenCalledWith(expect.objectContaining({ disableClusteringAtZoom: 15 }));
  });

  it("shows an empty-state message when there are no facilities", () => {
    render(<MapPanel shown={[]} visitedIds={new Set()} marks={{}} onBack={vi.fn()} onSelectFacility={vi.fn()} />);

    expect(screen.getByText("地図に表示する施設がありません")).toBeInTheDocument();
    expect(screen.getByText("0施設を表示")).toBeInTheDocument();
    expect(leafletMocks.map.setView).toHaveBeenCalledWith([36.5, 137.5], 5);
  });

  it("focuses the requested facility and opens its popup", () => {
    render(<MapPanel shown={facilities} visitedIds={new Set()} marks={{}} focusedFacilityId="tokyo-zoo" onBack={vi.fn()} onSelectFacility={vi.fn()} />);

    expect(leafletMocks.map.setView).toHaveBeenCalledWith([35.716, 139.771], 12);
    expect(leafletMocks.marker.openPopup).toHaveBeenCalled();
  });

  it("calls onBack from the header button", () => {
    const onBack = vi.fn();
    render(<MapPanel shown={facilities} visitedIds={new Set()} marks={{}} onBack={onBack} onSelectFacility={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "← 施設一覧" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("reopens the facility popup after marker data is refreshed", () => {
    const view = render(<MapPanel shown={facilities} visitedIds={new Set()} marks={{}} onBack={vi.fn()} onSelectFacility={vi.fn()} />);
    leafletMocks.clusterGroup.getLayers.mockReturnValue([leafletMocks.marker]);

    view.rerender(<MapPanel shown={facilities} visitedIds={new Set([facilities[0].id])} marks={{}} onBack={vi.fn()} onSelectFacility={vi.fn()} />);

    expect(leafletMocks.marker.openPopup).toHaveBeenCalled();
  });
});

describe("createFacilityPopup", () => {
  it("uses textContent for user-provided names and routes the detail button", () => {
    const unsafeFacility = { ...facilities[0], name: "<img src=x onerror=alert(1)>" };
    const onSelectFacility = vi.fn();
    const popup = createFacilityPopup(unsafeFacility, new Set(), {}, onSelectFacility);

    expect(popup.querySelector("img")).not.toBeInTheDocument();
    expect(popup.textContent).toContain(unsafeFacility.name);
    expect(popup.textContent).toContain("動物園");
    expect(popup.textContent).toContain("未訪問");
    fireEvent.click(popup.querySelector("button")!);
    expect(onSelectFacility).toHaveBeenCalledWith(unsafeFacility);
  });
});
