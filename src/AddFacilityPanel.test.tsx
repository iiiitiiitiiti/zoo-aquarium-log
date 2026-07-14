import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AddFacilityPanel from "./AddFacilityPanel";
import type { CustomFacilityDraft, CustomFacilityStore } from "./customFacilities";
import type { Facility } from "./types";

afterEach(() => vi.unstubAllGlobals());

class FakeCustomFacilityStore implements CustomFacilityStore {
  createCalls: CustomFacilityDraft[] = [];
  updateCalls: { id: string; draft: CustomFacilityDraft }[] = [];
  removeCalls: string[] = [];

  async create(draft: CustomFacilityDraft) {
    this.createCalls.push(draft);
    return { id: "custom_new", ...draft };
  }
  async update(id: string, draft: CustomFacilityDraft) {
    this.updateCalls.push({ id, draft });
    return { id, ...draft };
  }
  async remove(id: string) {
    this.removeCalls.push(id);
  }
  subscribe() {
    return () => undefined;
  }
}

const existingFacility: Facility = {
  id: "custom_existing",
  name: "編集前の水族館",
  kana: "へんしゅうまえのすいぞくかん",
  pref: "大阪府",
  city: "大阪市",
  type: "aquarium",
  lat: 34.7,
  lng: 135.5,
  url: "https://example.com/old",
  sourceUrls: ["https://example.com/old"],
  status: "closed",
  lastVerifiedAt: "2026-07-01",
};

describe("AddFacilityPanel", () => {
  it("施設名が空なら保存しない", async () => {
    const user = userEvent.setup();
    const store = new FakeCustomFacilityStore();
    render(<AddFacilityPanel store={store} onBack={() => undefined} onCreated={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "施設を保存" }));

    expect(store.createCalls).toHaveLength(0);
    expect(screen.getByText("施設名を入力してください")).toBeInTheDocument();
  });

  it("県庁所在地の座標とGoogleマップURLを初期値として保存する", async () => {
    const user = userEvent.setup();
    const store = new FakeCustomFacilityStore();
    const onCreated = vi.fn();
    render(<AddFacilityPanel store={store} onBack={() => undefined} onCreated={onCreated} />);

    await user.type(screen.getByLabelText("施設名"), "佐賀パンダ園");
    await user.selectOptions(screen.getByLabelText("都道府県"), "佐賀県");
    await user.type(screen.getByLabelText("市区町村"), "佐賀市");
    await user.click(screen.getByRole("button", { name: "施設を保存" }));

    expect(store.createCalls[0]).toMatchObject({
      name: "佐賀パンダ園",
      pref: "佐賀県",
      lat: 33.2494,
      lng: 130.2988,
      sourceUrls: ["https://www.google.com/maps/search/?api=1&query=%E4%BD%90%E8%B3%80%E3%83%91%E3%83%B3%E3%83%80%E5%9C%92%20%E4%BD%90%E8%B3%80%E7%9C%8C%20%E4%BD%90%E8%B3%80%E5%B8%82"],
    });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "custom_new" }));
  });

  it("GPS成功時は座標を上書きし、失敗時も保存できる", async () => {
    const user = userEvent.setup();
    const successStore = new FakeCustomFacilityStore();
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: vi.fn((success: (position: { coords: { latitude: number; longitude: number } }) => void) => success({ coords: { latitude: 35, longitude: 139 } })),
      },
    });
    render(<AddFacilityPanel store={successStore} onBack={() => undefined} onCreated={() => undefined} />);
    await user.type(screen.getByLabelText("施設名"), "GPS施設");
    await user.click(screen.getByRole("button", { name: "現在地を使う" }));
    await user.click(screen.getByRole("button", { name: "施設を保存" }));
    expect(successStore.createCalls[0]).toMatchObject({ lat: 35, lng: 139 });

    vi.unstubAllGlobals();
    const failedStore = new FakeCustomFacilityStore();
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: vi.fn((_success: unknown, failure: (error: unknown) => void) => failure(new Error("denied"))),
      },
    });
    render(<AddFacilityPanel store={failedStore} onBack={() => undefined} onCreated={() => undefined} />);
    await user.type(screen.getAllByLabelText("施設名")[1], "GPS失敗施設");
    await user.click(screen.getAllByRole("button", { name: "現在地を使う" })[1]);
    await user.click(screen.getAllByRole("button", { name: "施設を保存" })[1]);
    expect(failedStore.createCalls).toHaveLength(1);
  });

  it("編集モードでは初期値を表示し、同じIDに保存する", async () => {
    const user = userEvent.setup();
    const store = new FakeCustomFacilityStore();
    render(<AddFacilityPanel store={store} initialFacility={existingFacility} onBack={() => undefined} onCreated={() => undefined} />);

    expect(screen.getByLabelText("施設名")).toHaveValue("編集前の水族館");
    expect(screen.getByLabelText("営業状態")).toHaveValue("closed");
    await user.clear(screen.getByLabelText("施設名"));
    await user.type(screen.getByLabelText("施設名"), "編集後の水族館");
    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    expect(store.updateCalls[0]).toMatchObject({ id: existingFacility.id, draft: { name: "編集後の水族館" } });
  });
});
