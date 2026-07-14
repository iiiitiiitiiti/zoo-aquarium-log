import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Facility } from "./types";
import type { Visit, VisitDraft, VisitStore } from "./visits";
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
  private onVisits: ((visits: Visit[]) => void) | undefined;
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
  subscribe(_facilityId: string, onVisits: (visits: Visit[]) => void) {
    this.onVisits = onVisits;
    return () => {
      this.onVisits = undefined;
    };
  }
  emit(visits: Visit[]) {
    this.onVisits?.(visits);
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

describe("VisitPanel", () => {
  it("訪問日・評価・メモを新規保存できる", async () => {
    const user = userEvent.setup();
    const store = new FakeVisitStore();
    render(<VisitPanel facility={facility} store={store} onBack={() => undefined} />);
    store.emit([]);

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
    render(<VisitPanel facility={facility} store={store} onBack={() => undefined} />);
    store.emit([]);

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
    render(<VisitPanel facility={facility} store={store} onBack={() => undefined} />);
    store.emit([]);

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
    render(<VisitPanel facility={facility} store={store} onBack={() => undefined} />);
    store.emit([existingVisit]);

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
    render(<VisitPanel facility={facility} store={store} onBack={() => undefined} />);
    store.emit([existingVisit]);

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
    render(<VisitPanel {...({ facility, store, onBack: () => undefined, photoStore } as any)} />);
    store.emit([]);

    await user.click(await screen.findByRole("button", { name: "訪問記録を追加" }));
    const file = new File(["photo"], "visit.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("訪問写真"), file);
    expect(await screen.findByRole("img", { name: "選択した訪問写真" })).toHaveAttribute("src", "blob:visit-preview");
    await user.click(screen.getByRole("button", { name: "記録を保存" }));

    expect(photoStore.upload).toHaveBeenCalledWith("new-visit-id", file);
    expect(store.createCalls[0]).toMatchObject({
      photoPath: "households/test/visits/new-visit-id/photo.webp",
    });

    store.emit([{
      ...existingVisit,
      photoPath: "households/test/visits/visit-1/photo.webp",
    }]);
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
    render(<VisitPanel {...({ facility, store, onBack: () => undefined, photoStore } as any)} />);
    store.emit([{
      ...existingVisit,
      photoPath: "households/test/visits/visit-1/photo.webp",
    }, {
      ...existingVisit,
      id: "visit-2",
      date: "2026-07-02",
      photoPath: "households/test/visits/visit-2/photo.webp",
    }]);

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
    render(<VisitPanel {...({ facility, store, onBack: () => undefined, photoStore } as any)} />);
    store.emit([{ ...existingVisit, photoPath }]);

    await user.click(await screen.findByRole("button", { name: "2026年7月1日の記録を編集" }));
    await user.click(screen.getByRole("button", { name: "写真を外す" }));
    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    expect(store.updateCalls[0].draft).toHaveProperty("photoPath", undefined);
    expect(photoStore.remove).toHaveBeenCalledWith(photoPath);
  });
});
