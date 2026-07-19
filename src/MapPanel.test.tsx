import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MapPanel, { createFacilityPopup } from "./MapPanel";
import type { Facility } from "./types";

const leafletMocks = vi.hoisted(() => {
  const createMap = () => {
    const panBy = vi.fn().mockReturnThis();
    const panTo = vi.fn().mockReturnThis();
    return {
      fitBounds: vi.fn().mockReturnThis(),
      getCenter: vi.fn(() => ({ lat: 35.716, lng: 139.771 })),
      getZoom: vi.fn(() => 12),
      invalidateSize: vi.fn(),
      on: vi.fn().mockReturnThis(),
      panBy,
      panByMock: panBy,
      panTo,
      panToMock: panTo,
      remove: vi.fn(),
      setView: vi.fn().mockReturnThis(),
    };
  };
  const tileLayer = { addTo: vi.fn().mockReturnThis() };
  const createClusterGroup = () => ({
    addLayers: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    clearLayers: vi.fn().mockReturnThis(),
    getLayers: vi.fn((): unknown[] => []),
  });
  const mapInstances: ReturnType<typeof createMap>[] = [];
  const clusterGroupInstances: ReturnType<typeof createClusterGroup>[] = [];
  const marker = {
    bindPopup: vi.fn().mockReturnThis(),
    isPopupOpen: vi.fn(() => true),
    openPopup: vi.fn().mockReturnThis(),
  };
  return {
    clusterGroupInstances,
    mapInstances,
    marker,
    tileLayer,
    leaflet: {
      DomEvent: { on: vi.fn((element: HTMLElement, _event: string, handler: () => void) => element.addEventListener("click", handler)) },
      divIcon: vi.fn((options) => options),
      latLngBounds: vi.fn((bounds) => bounds),
      map: vi.fn(() => {
        const map = createMap();
        mapInstances.push(map);
        return map;
      }),
      marker: vi.fn(() => marker),
      markerClusterGroup: vi.fn(() => {
        const clusterGroup = createClusterGroup();
        clusterGroupInstances.push(clusterGroup);
        return clusterGroup;
      }),
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
const facilitiesWithSecond = [
  ...facilities,
  { ...facilities[0], id: "osaka-aquarium", name: "海遊館", lat: 34.654, lng: 135.429 },
];

describe("MapPanel", () => {
  beforeEach(() => {
    leafletMocks.mapInstances.length = 0;
    leafletMocks.clusterGroupInstances.length = 0;
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
    expect(leafletMocks.leaflet.map).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
        inertia: true,
      }),
    );
    expect(leafletMocks.leaflet.markerClusterGroup).toHaveBeenCalledWith(expect.objectContaining({
      disableClusteringAtZoom: 15,
      animate: true,
    }));
  });

  it("disables Leaflet animations when the app preference is off", () => {
    render(<MapPanel shown={facilities} visitedIds={new Set()} marks={{}} animationsEnabled={false} onBack={vi.fn()} onSelectFacility={vi.fn()} />);

    expect(leafletMocks.leaflet.map).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
        inertia: false,
      }),
    );
    expect(leafletMocks.leaflet.markerClusterGroup).toHaveBeenCalledWith(expect.objectContaining({ animate: false }));
    expect(leafletMocks.mapInstances[0].setView).toHaveBeenCalledWith([35.716, 139.771], 12, { animate: false });
    leafletMocks.mapInstances[0].panBy([20, 0]);
    leafletMocks.mapInstances[0].panTo([35.8, 139.8]);
    expect(leafletMocks.mapInstances[0].panByMock).toHaveBeenCalledWith([20, 0], { animate: false });
    expect(leafletMocks.mapInstances[0].panToMock).toHaveBeenCalledWith([35.8, 139.8], { animate: false });
  });

  it("recreates the map when the animation preference changes", () => {
    const view = render(<MapPanel shown={facilities} visitedIds={new Set()} marks={{}} animationsEnabled onBack={vi.fn()} onSelectFacility={vi.fn()} />);

    view.rerender(<MapPanel shown={facilities} visitedIds={new Set()} marks={{}} animationsEnabled={false} onBack={vi.fn()} onSelectFacility={vi.fn()} />);

    expect(leafletMocks.mapInstances[0].remove).toHaveBeenCalledOnce();
    expect(leafletMocks.leaflet.map).toHaveBeenCalledTimes(2);
    expect(leafletMocks.leaflet.markerClusterGroup).toHaveBeenCalledTimes(2);
    expect(leafletMocks.clusterGroupInstances[1].addLayers).toHaveBeenCalledWith(expect.any(Array));
    expect(leafletMocks.leaflet.map).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ zoomAnimation: false, inertia: false }),
    );
  });

  it("preserves the viewport and open popup when recreating the map", () => {
    const view = render(<MapPanel shown={facilities} visitedIds={new Set()} marks={{}} animationsEnabled onBack={vi.fn()} onSelectFacility={vi.fn()} />);
    leafletMocks.mapInstances[0].getCenter.mockReturnValue({ lat: 34.7, lng: 135.4 });
    leafletMocks.mapInstances[0].getZoom.mockReturnValue(8);
    leafletMocks.clusterGroupInstances[0].getLayers.mockReturnValue([leafletMocks.marker]);

    view.rerender(<MapPanel shown={facilities} visitedIds={new Set()} marks={{}} animationsEnabled={false} onBack={vi.fn()} onSelectFacility={vi.fn()} />);

    expect(leafletMocks.mapInstances[1].setView).toHaveBeenCalledWith(
      { lat: 34.7, lng: 135.4 },
      8,
      { animate: false },
    );
    expect(leafletMocks.marker.openPopup).toHaveBeenCalled();
  });

  it("passes the animation preference to fitBounds", () => {
    render(<MapPanel shown={facilitiesWithSecond} visitedIds={new Set()} marks={{}} animationsEnabled={false} onBack={vi.fn()} onSelectFacility={vi.fn()} />);

    expect(leafletMocks.mapInstances[0].fitBounds).toHaveBeenCalledWith(
      expect.anything(),
      { padding: [24, 24], animate: false },
    );
  });

  it("shows an empty-state message when there are no facilities", () => {
    render(<MapPanel shown={[]} visitedIds={new Set()} marks={{}} onBack={vi.fn()} onSelectFacility={vi.fn()} />);

    expect(screen.getByText("地図に表示する施設がありません")).toBeInTheDocument();
    expect(screen.getByText("0施設を表示")).toBeInTheDocument();
    expect(leafletMocks.mapInstances[0].setView).toHaveBeenCalledWith([36.5, 137.5], 5, { animate: true });
  });

  it("focuses the requested facility and opens its popup", () => {
    render(<MapPanel shown={facilities} visitedIds={new Set()} marks={{}} focusedFacilityId="tokyo-zoo" onBack={vi.fn()} onSelectFacility={vi.fn()} />);

    expect(leafletMocks.mapInstances[0].setView).toHaveBeenCalledWith([35.716, 139.771], 12, { animate: true });
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
    leafletMocks.clusterGroupInstances[0].getLayers.mockReturnValue([leafletMocks.marker]);

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
