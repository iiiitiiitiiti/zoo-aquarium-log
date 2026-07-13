import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Facility } from "./types";
import type { Visit, VisitDraft, VisitStore } from "./visits";
import VisitPanel from "./VisitPanel";

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
});
