import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Facility } from "./types";
import type { Visit, VisitDraft, VisitStore } from "./visits";
import type { CustomFacilityStore } from "./customFacilities";
import type { FacilityNoteStore } from "./facilityNotes";
import VisitPanel from "./VisitPanel";

afterEach(() => vi.unstubAllGlobals());

const facility: Facility = {
  id: "tokyo-ueno-zoo",
  name: "恩賜上野動物園",
  kana: "おんしうえのどうぶつえん",
  pref: "東京都",
  city: "台東区",
  type: "zoo",
  lat: 35.716,
  lng: 139.772,
  url: "https://www.tokyo-zoo.net/zoo/ueno/",
  sourceUrls: ["https://www.tokyo-zoo.net/zoo/ueno/"],
  status: "open",
  lastVerifiedAt: "2026-07-13",
};

class FakeVisitStore implements VisitStore {
  createCalls: VisitDraft[] = [];
  updateCalls: { id: string; draft: Omit<VisitDraft, "id"> }[] = [];
  removeCalls: string[] = [];
  createPromise: Promise<void> | undefined;

  newId() {
    return "new-visit-id";
  }
  async create(draft: VisitDraft) {
    this.createCalls.push(draft);
    await this.createPromise;
  }
  async update(id: string, draft: Omit<VisitDraft, "id">) {
    this.updateCalls.push({ id, draft });
  }
  async remove(id: string) {
    this.removeCalls.push(id);
  }
  subscribeAll() {
    return () => undefined;
  }
}

const existingVisit = {
  id: "visit-1",
  facilityId: facility.id,
  date: "2026-07-01",
  rating: 5,
  memo: "パンダに会えた",
  visitor: "家族",
  createdAt: {} as Visit["createdAt"],
  updatedAt: {} as Visit["updatedAt"],
};

const customFacility = { ...facility, id: "custom_facility" };

class FakeFacilityNoteStore implements FacilityNoteStore {
  saveCalls: { facilityId: string; text: string }[] = [];
  async save(facilityId: string, text: string) {
    this.saveCalls.push({ facilityId, text });
  }
  subscribe() {
    return () => undefined;
  }
}

describe("VisitPanel", () => {
  it("施設詳細から地図表示を依頼できる", async () => {
    const user = userEvent.setup();
    const onShowOnMap = vi.fn();
    render(<VisitPanel facility={facility} store={new FakeVisitStore()} visits={[]} onBack={() => undefined} onShowOnMap={onShowOnMap} />);

    await user.click(screen.getByRole("button", { name: "地図で場所を見る" }));

    expect(onShowOnMap).toHaveBeenCalledOnce();
  });

  it("施設の補足（note）があれば表示する", () => {
    const noted = { ...facility, note: "冬季（12〜3月）は定例休園。2026-07-15時点。" };
    render(<VisitPanel facility={noted} store={new FakeVisitStore()} visits={[]} onBack={() => undefined} />);

    expect(screen.getByText("冬季（12〜3月）は定例休園。2026-07-15時点。")).toBeInTheDocument();
  });

  it("施設の補足（note）がなければ表示しない", () => {
    const { container } = render(<VisitPanel facility={facility} store={new FakeVisitStore()} visits={[]} onBack={() => undefined} />);

    expect(container.querySelector(".facility-note")).toBeNull();
  });

  it("施設メモを表示・編集・保存でき、編集中状態を集約して通知する", async () => {
    const user = userEvent.setup();
    const store = new FakeFacilityNoteStore();
    const onEditingChange = vi.fn();
    render(<VisitPanel
      facility={facility}
      store={new FakeVisitStore()}
      visits={[]}
      note={{ text: "駐車場は東園側。", updatedAt: null }}
      noteStore={store}
      onEditingChange={onEditingChange}
      onBack={() => undefined}
    />);

    expect(screen.getByText("駐車場は東園側。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "編集" }));
    expect(onEditingChange).toHaveBeenLastCalledWith(true);
    await user.clear(screen.getByRole("textbox", { name: "施設メモ" }));
    await user.type(screen.getByRole("textbox", { name: "施設メモ" }), "次回はイルカショーへ\n持ち物：帽子");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(store.saveCalls).toEqual([{ facilityId: facility.id, text: "次回はイルカショーへ\n持ち物：帽子" }]);
    expect(onEditingChange).toHaveBeenLastCalledWith(false);
  });

  it("施設メモの読み込み中とエラー時は編集できない", () => {
    const store = new FakeFacilityNoteStore();
    const { rerender } = render(<VisitPanel
      facility={facility}
      store={new FakeVisitStore()}
      visits={[]}
      noteStore={store}
      notesLoading
      onBack={() => undefined}
    />);
    expect(screen.getByText("メモを読み込んでいます")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "メモを追加" })).not.toBeInTheDocument();

    rerender(<VisitPanel
      facility={facility}
      store={new FakeVisitStore()}
      visits={[]}
      noteStore={store}
      noteLoadError="施設メモを読み込めませんでした。通信環境を確認してください"
      onBack={() => undefined}
    />);
    expect(screen.getByRole("alert", { name: "" })).toHaveTextContent("メモを読み込めませんでした");
    expect(screen.getByRole("button", { name: "メモを追加" })).toBeDisabled();
  });

  it("訪問日・評価・メモを新規保存できる", async () => {
    const user = userEvent.setup();
    const store = new FakeVisitStore();
    render(<VisitPanel facility={facility} store={store} visits={[]} onBack={() => undefined} />);

    await user.click(await screen.findByRole("button", { name: "訪問記録を追加" }));
    const date = screen.getByLabelText("訪問日");
    await user.clear(date);
    await user.type(date, "2026-07-13");
    await user.selectOptions(screen.getByLabelText("評価"), "5");
    await user.type(screen.getByLabelText("メモ・感想"), "家族で楽しかった 🐼");
    await user.type(screen.getByLabelText("一緒に行った人"), "家族");
    await user.click(screen.getByRole("button", { name: "記録を保存" }));

    expect(store.createCalls).toEqual([{
      id: "new-visit-id",
      facilityId: facility.id,
      date: "2026-07-13",
      rating: 5,
      memo: "家族で楽しかった 🐼",
      visitor: "家族",
    }]);
  });

  it("訪問日が空なら保存しない", async () => {
    const user = userEvent.setup();
    const store = new FakeVisitStore();
    render(<VisitPanel facility={facility} store={store} visits={[]} onBack={() => undefined} />);

    await user.click(await screen.findByRole("button", { name: "訪問記録を追加" }));
    await user.clear(screen.getByLabelText("訪問日"));
    await user.click(screen.getByRole("button", { name: "記録を保存" }));

    expect(store.createCalls).toEqual([]);
    expect(screen.getByText("訪問日を入力してください")).toBeInTheDocument();
  });

  it("保存処理中の連続送信は1回だけ作成する", async () => {
    const user = userEvent.setup();
    const store = new FakeVisitStore();
    let finishCreate: () => void = () => undefined;
    store.createPromise = new Promise<void>((resolve) => {
      finishCreate = resolve;
    });
    render(<VisitPanel facility={facility} store={store} visits={[]} onBack={() => undefined} />);

    await user.click(await screen.findByRole("button", { name: "訪問記録を追加" }));
    const form = screen.getByRole("button", { name: "記録を保存" }).closest("form");
    if (!form) throw new Error("visit form not found");
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(store.createCalls).toHaveLength(1);
    finishCreate();
    await waitFor(() => expect(screen.queryByRole("button", { name: "記録を保存" })).not.toBeInTheDocument());
  });

  it("既存の訪問記録を編集できる", async () => {
    const user = userEvent.setup();
    const store = new FakeVisitStore();
    render(<VisitPanel facility={facility} store={store} visits={[existingVisit]} onBack={() => undefined} />);

    await user.click(await screen.findByRole("button", { name: "2026年7月1日の記録を編集" }));
    const memo = screen.getByLabelText("メモ・感想");
    await user.clear(memo);
    await user.type(memo, "編集しました");
    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    expect(store.updateCalls[0]).toMatchObject({
      id: "visit-1",
      draft: { memo: "編集しました", facilityId: facility.id },
    });
  });

  it("確認後に訪問記録を削除できる", async () => {
    const user = userEvent.setup();
    const store = new FakeVisitStore();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<VisitPanel facility={facility} store={store} visits={[existingVisit]} onBack={() => undefined} />);

    await user.click(await screen.findByRole("button", { name: "2026年7月1日の記録を削除" }));

    expect(store.removeCalls).toEqual(["visit-1"]);
  });

  it("訪問写真を追加して保存し、記録一覧に表示できる", async () => {
    const user = userEvent.setup();
    const store = new FakeVisitStore();
    vi.stubGlobal("URL", { ...globalThis.URL, createObjectURL: vi.fn(() => "blob:visit-preview"), revokeObjectURL: vi.fn() });
    const photoStore = {
      upload: vi.fn(async (visitId: string, _file: File) => `households/test/visits/${visitId}/photo.webp`),
      getUrl: vi.fn(async (path: string) => `https://storage.example/${path}`),
      remove: vi.fn(async (_path: string) => undefined),
    };
    const { rerender } = render(<VisitPanel {...({ facility, store, visits: [], onBack: () => undefined, photoStore } as any)} />);

    await user.click(await screen.findByRole("button", { name: "訪問記録を追加" }));
    const file = new File(["photo"], "visit.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("訪問写真"), file);
    expect(await screen.findByRole("img", { name: "選択した訪問写真" })).toHaveAttribute("src", "blob:visit-preview");
    await user.click(screen.getByRole("button", { name: "記録を保存" }));

    expect(photoStore.upload).toHaveBeenCalledWith("new-visit-id", file);
    expect(store.createCalls[0]).toMatchObject({
      photoPath: "households/test/visits/new-visit-id/photo.webp",
    });

    rerender(<VisitPanel {...({ facility, store, visits: [{
      ...existingVisit,
      photoPath: "households/test/visits/visit-1/photo.webp",
    }], onBack: () => undefined, photoStore } as any)} />);
    expect(await screen.findByRole("img", { name: "2026年7月1日の訪問写真" }))
      .toHaveAttribute("src", "https://storage.example/households/test/visits/visit-1/photo.webp");
  });

  it("訪問写真をURLごとに表示する", async () => {
    const store = new FakeVisitStore();
    let resolveFirst!: (url: string) => void;
    let resolveSecond!: (url: string) => void;
    const photoStore = {
      upload: vi.fn(async () => ""),
      getUrl: vi.fn((path: string) => new Promise<string>((resolve) => {
        if (path.endsWith("visit-1/photo.webp")) resolveFirst = resolve;
        else resolveSecond = resolve;
      })),
      remove: vi.fn(async () => undefined),
    };
    render(<VisitPanel {...({ facility, store, visits: [{
      ...existingVisit,
      photoPath: "households/test/visits/visit-1/photo.webp",
    }, {
      ...existingVisit,
      id: "visit-2",
      date: "2026-07-02",
      photoPath: "households/test/visits/visit-2/photo.webp",
    }], onBack: () => undefined, photoStore } as any)} />);

    await waitFor(() => expect(photoStore.getUrl).toHaveBeenCalledTimes(2));
    resolveFirst("https://storage.example/first.webp");
    expect(await screen.findByRole("img", { name: "2026年7月1日の訪問写真" }))
      .toHaveAttribute("src", "https://storage.example/first.webp");
    resolveSecond("https://storage.example/second.webp");
    expect(await screen.findByRole("img", { name: "2026年7月2日の訪問写真" }))
      .toHaveAttribute("src", "https://storage.example/second.webp");
  });

  it("訪問写真を外して保存できる", async () => {
    const user = userEvent.setup();
    const store = new FakeVisitStore();
    const photoPath = "households/test/visits/visit-1/photo.webp";
    const photoStore = {
      upload: vi.fn(),
      getUrl: vi.fn(async (_path: string) => "https://storage.example/photo.webp"),
      remove: vi.fn(async (_path: string) => undefined),
    };
    render(<VisitPanel {...({ facility, store, visits: [{ ...existingVisit, photoPath }], onBack: () => undefined, photoStore } as any)} />);

    await user.click(await screen.findByRole("button", { name: "2026年7月1日の記録を編集" }));
    await user.click(screen.getByRole("button", { name: "写真を外す" }));
    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    expect(store.updateCalls[0].draft).toHaveProperty("photoPath", undefined);
    expect(photoStore.remove).toHaveBeenCalledWith(photoPath);
  });

  it("行きたいとお気に入りを正しい引数で切り替えられる", async () => {
    const user = userEvent.setup();
    const store = new FakeVisitStore();
    const markStore = { setFlag: vi.fn(async () => undefined), subscribe: () => () => undefined };
    render(<VisitPanel facility={facility} store={store} visits={[]} markStore={markStore} onBack={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "♡ 行きたい" }));
    await user.click(screen.getByRole("button", { name: "★ お気に入り" }));

    expect(markStore.setFlag).toHaveBeenNthCalledWith(1, facility.id, "wishlist", true);
    expect(markStore.setFlag).toHaveBeenNthCalledWith(2, facility.id, "favorite", true);
  });

  it("custom施設だけ編集・削除導線を表示する", async () => {
    const user = userEvent.setup();
    const store = new FakeVisitStore();
    const customStore: CustomFacilityStore = {
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(async () => undefined),
      subscribe: () => () => undefined,
    };
    const onEditFacility = vi.fn();
    const onBack = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<VisitPanel facility={customFacility} store={store} visits={[]} customFacilityStore={customStore} onEditFacility={onEditFacility} onBack={onBack} />);

    await user.click(screen.getByRole("button", { name: "編集" }));
    expect(onEditFacility).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "この施設を削除" }));
    expect(customStore.remove).toHaveBeenCalledWith(customFacility.id);
    expect(onBack).toHaveBeenCalledOnce();
  });
});
