import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import type { VisitStore } from "./visits";

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
  expect(screen.getByText("20施設を掲載")).toBeInTheDocument();
  await user.type(screen.getByRole("searchbox"),"上野");
  expect(screen.getByText("恩賜上野動物園")).toBeInTheDocument();
  expect(screen.queryByText("海遊館")).not.toBeInTheDocument();
  await user.clear(screen.getByRole("searchbox")); await user.click(screen.getByRole("button",{name:"水族館"}));
  expect(screen.getByText("海遊館")).toBeInTheDocument();
 });
 it("shows guidance when there are no results",async()=>{ const user=userEvent.setup(); render(<App />); await user.type(screen.getByRole("searchbox"),"存在しない"); expect(screen.getByText(/見つかりませんでした/)).toBeInTheDocument(); });
 it("施設カードから詳細ページへ移動し、公式サイトは詳細ページに表示する",async()=>{
  const user=userEvent.setup(); render(<App visitStore={visitStore} />);
  const card=screen.getByRole("link",{name:/札幌市円山動物園/});
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
  expect(screen.getByText("20施設を掲載")).toBeInTheDocument();
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
