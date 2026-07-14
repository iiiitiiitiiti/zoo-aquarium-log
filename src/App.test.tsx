import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import facilitiesJson from "./data/facilities.json";
import type { VisitStore } from "./visits";

const facilityCountText = `${facilitiesJson.length}施設を掲載`;

const visitStore: VisitStore = {
 newId:()=> "visit-id",
 create:async()=>undefined,
 update:async()=>undefined,
 remove:async()=>undefined,
 subscribe:(_facilityId,onVisits)=>{ onVisits([]); return ()=>undefined; },
};

describe("App",()=>{
 it("shows, searches and filters facilities",async()=>{
  const user=userEvent.setup(); render(<App />);
  await user.click(screen.getByText("施設を探す"));
  expect(screen.getByText(facilityCountText)).toBeInTheDocument();
  await user.type(screen.getByRole("searchbox"),"上野");
  expect(screen.getByText("恩賜上野動物園")).toBeInTheDocument();
  expect(screen.queryByText("海遊館")).not.toBeInTheDocument();
  await user.clear(screen.getByRole("searchbox")); await user.click(screen.getByRole("button",{name:"水族館"}));
  expect(screen.getByText("海遊館")).toBeInTheDocument();
 });
 it("shows guidance when there are no results",async()=>{ const user=userEvent.setup(); render(<App />); await user.click(screen.getByText("施設を探す")); await user.type(screen.getByRole("searchbox"),"存在しない"); expect(screen.getByText(/見つかりませんでした/)).toBeInTheDocument(); });
 it("filters facilities by prefecture",async()=>{
  const user=userEvent.setup(); render(<App />);
  await user.click(screen.getByText("施設を探す"));
  await user.selectOptions(screen.getByRole("combobox",{name:"都道府県"}),"北海道");
  expect(screen.getByText("札幌市円山動物園")).toBeInTheDocument();
  expect(screen.queryByText("恩賜上野動物園")).not.toBeInTheDocument();
 });
 it("hides search controls until opened and filters by operating status",async()=>{
  const user=userEvent.setup(); render(<App />);
  const summary=screen.getByRole("button",{name:/施設を探す/});
  expect(summary).toHaveAttribute("aria-expanded","false");
  expect(screen.getByText("都道府県")).toHaveClass("filter-group-label");
  await user.click(summary);
  expect(summary).toHaveAttribute("aria-expanded","true");
  await user.click(screen.getByRole("button",{name:"休園中"}));
  expect(screen.getByText("大宮公園小動物園")).toBeInTheDocument();
  expect(screen.queryByText("札幌市円山動物園")).not.toBeInTheDocument();
  await user.click(summary);
  expect(summary).toHaveAttribute("aria-expanded","false");
 });
 it("resets all facility filters",async()=>{
  const user=userEvent.setup(); render(<App />);
  const summary=screen.getByRole("button",{name:/施設を探す/});
  expect(screen.queryByRole("button",{name:"条件をリセット"})).not.toBeInTheDocument();
  await user.click(summary);
  const reset=screen.getByRole("button",{name:"条件をリセット"});
  expect(reset).toBeDisabled();
  await user.type(screen.getByRole("searchbox"),"上野");
  await user.click(screen.getByRole("button",{name:"水族館"}));
  await user.selectOptions(screen.getByRole("combobox",{name:"都道府県"}),"東京都");
  await user.click(screen.getByRole("button",{name:"休園中"}));
  expect(reset).toBeEnabled();
  await user.click(reset);
  expect(screen.getByRole("searchbox")).toHaveValue("");
  expect(screen.getByRole("combobox",{name:"都道府県"})).toHaveValue("all");
  expect(screen.getByRole("group",{name:"種別"}).querySelector('[aria-pressed="true"]')).toHaveTextContent("すべて");
  expect(screen.getByRole("group",{name:"営業状態"}).querySelector('[aria-pressed="true"]')).toHaveTextContent("すべて");
  expect(reset).toBeDisabled();
 });
 it("施設カードから詳細ページへ移動し、公式サイトは詳細ページに表示する",async()=>{
  const user=userEvent.setup(); render(<App visitStore={visitStore} />);
  const card=screen.getByRole("link",{name:/札幌市円山動物園/});
  expect(card.querySelector(".card-arrow")).toHaveTextContent("→");
  expect(card).toHaveAttribute("href","#facility/hokkaido_maruyama_zoo");
  expect(screen.queryByRole("link",{name:/公式サイト/})).not.toBeInTheDocument();
  await user.click(card);
  expect(screen.getByRole("heading",{name:"札幌市円山動物園"})).toBeInTheDocument();
  expect(screen.getByRole("link",{name:/公式サイト/})).toHaveAttribute("target","_blank");
 });
 it("opens a facility visit log and returns to the list",async()=>{
  const user=userEvent.setup(); render(<App visitStore={visitStore} />);
  await user.click(screen.getByRole("link",{name:/札幌市円山動物園/}));
  expect(screen.getByRole("heading",{name:"札幌市円山動物園"})).toBeInTheDocument();
  await user.click(screen.getByRole("button",{name:/施設一覧/}));
  expect(screen.getByText(facilityCountText)).toBeInTheDocument();
 });
 it("shows logout on the facility list but not the detail view",async()=>{
  const user=userEvent.setup();
  const onSignOut=vi.fn(async()=>undefined);
  render(<App visitStore={visitStore} onSignOut={onSignOut} />);

  await user.click(screen.getByRole("button",{name:"ログアウト"}));
  expect(onSignOut).toHaveBeenCalledOnce();

  await user.click(screen.getByRole("link",{name:/札幌市円山動物園/}));
  expect(screen.queryByRole("button",{name:"ログアウト"})).not.toBeInTheDocument();
 });
});
