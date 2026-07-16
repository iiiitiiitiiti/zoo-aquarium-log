import { act, render, screen, waitFor } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { CustomFacilityStore } from "./customFacilities";
import type { FacilityNoteStore } from "./facilityNotes";
import facilitiesJson from "./data/facilities.json";
import type { MarkStore } from "./marks";
import type { Visit, VisitStore } from "./visits";

vi.mock("./MapPanel", () => ({
  default: ({ shown, focusedFacilityId, onBack, onSelectFacility }: { shown: { id: string; name: string }[]; focusedFacilityId?: string; onBack: () => void; onSelectFacility: (facility: { id: string; name: string }) => void }) => (
    <main>
      <h1>施設マップ</h1>
      <p>{shown.length}施設を表示</p>
      {shown.map((facility) => <span key={facility.id}>{facility.name}</span>)}
      <p data-testid="map-focus">{focusedFacilityId}</p>
      {shown[0] && <button type="button" onClick={() => onSelectFacility(shown[0])}>詳細を見る</button>}
      <button type="button" onClick={onBack}>← 施設一覧</button>
    </main>
  ),
}));

const facilityCountText = `${facilitiesJson.length}施設を掲載`;

const visitStore: VisitStore = {
 newId:()=> "visit-id",
 create:async()=>undefined,
 update:async()=>undefined,
 remove:async()=>undefined,
 subscribeAll:(onVisits)=>{ onVisits([]); return ()=>undefined; },
};

const exportVisit: Visit = {
 id:"visit-export",
 facilityId:"deleted_custom_facility",
 date:"2026-07-01",
 memo:"日本語のメモ 🐘",
 createdAt:Timestamp.fromDate(new Date("2026-07-01T01:02:03.000Z")),
 updatedAt:Timestamp.fromDate(new Date("2026-07-02T01:02:03.000Z")),
};
const exportFacility = {
 id:"custom_export",
 name:"家族の水族館",
 kana:"かぞくのすいぞくかん",
 pref:"東京都",
 city:"台東区",
 type:"aquarium" as const,
 lat:35.7,
 lng:139.8,
 url:"https://example.com/aquarium",
 sourceUrls:["https://example.com/aquarium"],
 status:"open" as const,
 lastVerifiedAt:"2026-07-14",
};

function readBlob(blob: Blob) {
 return new Promise<string>((resolve, reject) => {
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result));
  reader.onerror=()=>reject(reader.error);
  reader.readAsText(blob);
 });
}

async function openQuickActions(user: ReturnType<typeof userEvent.setup>) {
 await user.click(screen.getByRole("button",{name:"その他の操作"}));
}

afterEach(() => {
 vi.restoreAllMocks();
 vi.unstubAllGlobals();
});

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
 it("groups the list by prefecture while keeping facility numbers continuous",()=>{
  render(<App />);
  expect(screen.getByRole("heading",{name:"北海道",level:3})).toBeInTheDocument();
  expect(screen.getByRole("heading",{name:"青森県",level:3})).toBeInTheDocument();
  const groups=document.querySelectorAll<HTMLElement>(".prefecture-group");
  expect(groups.length).toBeGreaterThan(1);
  expect(groups[0].querySelector(".card-index")).toHaveTextContent("01");
  expect(groups[1].querySelector(".card-index")).not.toHaveTextContent("01");
 });
 it("shows guidance when there are no results",async()=>{ const user=userEvent.setup(); render(<App />); await user.click(screen.getByText("施設を探す")); await user.type(screen.getByRole("searchbox"),"存在しない"); expect(screen.getByText(/見つかりませんでした/)).toBeInTheDocument(); });
 it("shows only matching prefecture headings after filtering",async()=>{
  const user=userEvent.setup(); render(<App />);
  await user.click(screen.getByText("施設を探す"));
  await user.selectOptions(screen.getByRole("combobox",{name:"都道府県"}),"北海道");
  expect(screen.getByRole("heading",{name:"北海道",level:3})).toBeInTheDocument();
  expect(screen.queryByRole("heading",{name:"青森県",level:3})).not.toBeInTheDocument();
  await user.type(screen.getByRole("searchbox"),"存在しない");
  expect(screen.queryByRole("heading",{name:"北海道",level:3})).not.toBeInTheDocument();
 });
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
 it("同期したブラウザ履歴で詳細画面を戻る・進むできる",async()=>{
  window.history.replaceState(null,"",window.location.pathname);
  window.history.pushState(null,"",`${window.location.pathname}#list`);
  const user=userEvent.setup(); render(<App visitStore={visitStore} />);
  await user.click(screen.getByRole("link",{name:/札幌市円山動物園/}));
  expect(screen.getByRole("heading",{name:"札幌市円山動物園"})).toBeInTheDocument();
  act(() => {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}#list`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await waitFor(()=>expect(screen.getByText(facilityCountText)).toBeInTheDocument());
  act(() => {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}#facility/hokkaido_maruyama_zoo`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await waitFor(()=>expect(screen.getByRole("heading",{name:"札幌市円山動物園"})).toBeInTheDocument());
 });
 it("opens a facility visit log and returns to the list",async()=>{
  const user=userEvent.setup(); render(<App visitStore={visitStore} />);
  await user.click(screen.getByRole("link",{name:/札幌市円山動物園/}));
  expect(screen.getByRole("heading",{name:"札幌市円山動物園"})).toBeInTheDocument();
  await user.click(screen.getByRole("button",{name:/施設一覧/}));
  expect(screen.getByText(facilityCountText)).toBeInTheDocument();
 });
 it("animates cards on the initial list but not after returning from a detail",async()=>{
  const user=userEvent.setup(); render(<App visitStore={visitStore} />);
  expect(document.querySelector<HTMLElement>(".facility-list")).toHaveClass("facility-list", "facility-list--animated");
  await user.click(screen.getByRole("link",{name:/札幌市円山動物園/}));
  await user.click(screen.getByRole("button",{name:/施設一覧/}));
  expect(document.querySelector<HTMLElement>(".facility-list")).toHaveClass("facility-list");
  expect(document.querySelector<HTMLElement>(".facility-list")).not.toHaveClass("facility-list--animated");
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
 it("filters facilities by visit status from the shared stores",async()=>{
  const user=userEvent.setup();
  const target=facilitiesJson[0];
  const markStore={
   setFlag:vi.fn(async()=>undefined),
   subscribe:(onMarks: (marks: Record<string,{wishlist:boolean;favorite:boolean}>)=>void)=>{ onMarks({[target.id]:{wishlist:true,favorite:false}}); return ()=>undefined; },
  };
  render(<App visitStore={visitStore} markStore={markStore} />);
  await user.click(screen.getByText("施設を探す"));
  await user.click(screen.getByRole("button",{name:"行きたい"}));
  expect(screen.getByText(target.name)).toBeInTheDocument();
  expect(screen.getByText("1施設が該当")).toBeInTheDocument();
 });
 it("disables visit filters until visit and mark snapshots arrive",async()=>{
  const user=userEvent.setup();
  let emitVisits: ((visits: never[])=>void)|undefined;
  let emitMarks: ((marks: Record<string,{wishlist:boolean;favorite:boolean}>)=>void)|undefined;
  const loadingVisitStore: VisitStore={
   ...visitStore,
   subscribeAll:(onVisits)=>{ emitVisits=onVisits as (visits: never[])=>void; return ()=>undefined; },
  };
  const loadingMarkStore={
   setFlag:vi.fn(async()=>undefined),
   subscribe:(onMarks: (marks: Record<string,{wishlist:boolean;favorite:boolean}>)=>void)=>{ emitMarks=onMarks; return ()=>undefined; },
  };
  render(<App visitStore={loadingVisitStore} markStore={loadingMarkStore} />);
  await user.click(screen.getByText("施設を探す"));
  expect(screen.getByRole("button",{name:"訪問済み"})).toBeDisabled();
  emitVisits?.([]);
  emitMarks?.({});
  await waitFor(()=>expect(screen.getByRole("button",{name:"訪問済み"})).toBeEnabled());
 });
 it("downloads the shared data as UTF-8 JSON",async()=>{
  const user=userEvent.setup();
  const blobs: Blob[]=[];
  const createObjectURL=vi.fn((blob: Blob)=>{ blobs.push(blob); return "blob:export"; });
  const revokeObjectURL=vi.fn();
  vi.stubGlobal("URL", { ...globalThis.URL, createObjectURL, revokeObjectURL });
  const click=vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>undefined);
  const exportVisitStore: VisitStore={...visitStore,subscribeAll:(onVisits)=>{ onVisits([exportVisit]); return ()=>undefined; }};
  const markStore: MarkStore={
   setFlag:vi.fn(async()=>undefined),
   subscribe:(onMarks)=>{ onMarks({deleted_custom_facility:{wishlist:true,favorite:false}}); return ()=>undefined; },
  };
  const customFacilityStore: CustomFacilityStore={
   create:async()=>exportFacility,
   update:async()=>exportFacility,
   remove:async()=>undefined,
   subscribe:(onFacilities)=>{ onFacilities([exportFacility]); return ()=>undefined; },
  };
  const facilityNoteStore: FacilityNoteStore={
   save:async()=>undefined,
   subscribe:(onNotes)=>{ onNotes({[exportFacility.id]:{text:"次回はイルカショー",updatedAt:Timestamp.fromDate(new Date("2026-07-14T01:02:03.000Z"))}}); return ()=>undefined; },
  };
  render(<App visitStore={exportVisitStore} markStore={markStore} customFacilityStore={customFacilityStore} facilityNoteStore={facilityNoteStore} />);

  await openQuickActions(user);
  const button=await screen.findByRole("button",{name:"JSONを保存"});
  expect(button).toBeEnabled();
  await user.click(button);

  expect(click).toHaveBeenCalledOnce();
  expect(createObjectURL).toHaveBeenCalledOnce();
  const data=JSON.parse(await readBlob(blobs[0]));
  expect(data.visits[0]).toMatchObject({facilityId:"deleted_custom_facility",memo:"日本語のメモ 🐘"});
  expect(data.marks).toEqual([{facilityId:"deleted_custom_facility",wishlist:true,favorite:false}]);
  expect(data.customFacilities[0]).toMatchObject({name:"家族の水族館"});
  expect(data.facilityNotes).toEqual([{facilityId:"custom_export",text:"次回はイルカショー",updatedAt:"2026-07-14T01:02:03.000Z"}]);
  await waitFor(()=>expect(revokeObjectURL).toHaveBeenCalledWith("blob:export"));
 });
 it("keeps export disabled until visits, marks, and custom facilities are ready",async()=>{
  const user=userEvent.setup();
  let emitVisits: ((visits: Visit[])=>void)|undefined;
  let emitMarks: ((marks: Record<string,{wishlist:boolean;favorite:boolean}>)=>void)|undefined;
  let emitCustomFacilities: ((facilities: typeof exportFacility[])=>void)|undefined;
  const loadingVisitStore: VisitStore={
   ...visitStore,
   subscribeAll:(onVisits)=>{ emitVisits=onVisits; return ()=>undefined; },
  };
  const loadingMarkStore: MarkStore={
   setFlag:vi.fn(async()=>undefined),
   subscribe:(onMarks)=>{ emitMarks=onMarks; return ()=>undefined; },
  };
  const loadingCustomFacilityStore: CustomFacilityStore={
   create:async()=>exportFacility,
   update:async()=>exportFacility,
   remove:async()=>undefined,
   subscribe:(onFacilities)=>{ emitCustomFacilities=onFacilities; return ()=>undefined; },
  };
  vi.stubGlobal("URL", { ...globalThis.URL, createObjectURL:vi.fn(() => "blob:export"), revokeObjectURL:vi.fn() });
  render(<App visitStore={loadingVisitStore} markStore={loadingMarkStore} customFacilityStore={loadingCustomFacilityStore} />);
  await openQuickActions(user);
  const button=screen.getByRole("button",{name:"JSONを保存"});
  expect(button).toBeDisabled();
  emitVisits?.([]);
  expect(button).toBeDisabled();
  emitMarks?.({});
  expect(button).toBeDisabled();
  emitCustomFacilities?.([]);
  await waitFor(()=>expect(button).toBeEnabled());
 });
 it("keeps export disabled when a data subscription fails",async()=>{
  const user=userEvent.setup();
  const failingVisitStore: VisitStore={
   ...visitStore,
   subscribeAll:(_onVisits,onError)=>{ onError(new Error("failed")); return ()=>undefined; },
  };
  const markStore: MarkStore={
   setFlag:vi.fn(async()=>undefined),
   subscribe:(onMarks)=>{ onMarks({}); return ()=>undefined; },
  };
  const customFacilityStore: CustomFacilityStore={
   create:async()=>exportFacility,
   update:async()=>exportFacility,
   remove:async()=>undefined,
   subscribe:(onFacilities)=>{ onFacilities([]); return ()=>undefined; },
  };
  vi.stubGlobal("URL", { ...globalThis.URL, createObjectURL:vi.fn(() => "blob:export"), revokeObjectURL:vi.fn() });
  render(<App visitStore={failingVisitStore} markStore={markStore} customFacilityStore={customFacilityStore} />);
  await openQuickActions(user);
  expect(await screen.findByRole("button",{name:"JSONを保存"})).toBeDisabled();
 });
 it("hides the rare actions until the quick action panel is opened",async()=>{
  const user=userEvent.setup();
  render(<App customFacilityStore={{
   create:async()=>exportFacility,
   update:async()=>exportFacility,
   remove:async()=>undefined,
   subscribe:(onFacilities)=>{ onFacilities([]); return ()=>undefined; },
  }} />);
  const summary=screen.getByRole("button",{name:"その他の操作"});
  expect(summary).toHaveAttribute("aria-expanded","false");
  expect(screen.queryByRole("button",{name:"JSONを保存"})).not.toBeInTheDocument();
  await openQuickActions(user);
  expect(summary).toHaveAttribute("aria-expanded","true");
  expect(screen.getByRole("button",{name:"施設を追加"})).toBeInTheDocument();
  expect(screen.getByRole("button",{name:"JSONを保存"})).toBeInTheDocument();
 });
 it("keeps the export button visible when search results are empty",async()=>{
  const user=userEvent.setup();
  vi.stubGlobal("URL", { ...globalThis.URL, createObjectURL:vi.fn(() => "blob:export"), revokeObjectURL:vi.fn() });
  render(<App />);
  await user.click(screen.getByRole("button",{name:/施設を探す/}));
  await user.type(screen.getByRole("searchbox"),"存在しない施設");
  expect(screen.getByText(/見つかりませんでした/)).toBeInTheDocument();
  await openQuickActions(user);
  expect(screen.getByRole("button",{name:"JSONを保存"})).toBeInTheDocument();
 });
 it("shows the add and export actions directly below the search controls",async()=>{
  const user=userEvent.setup();
  render(<App customFacilityStore={{
   create:async()=>exportFacility,
   update:async()=>exportFacility,
   remove:async()=>undefined,
   subscribe:(onFacilities)=>{ onFacilities([]); return ()=>undefined; },
  }} />);
  const summary=screen.getByRole("button",{name:"その他の操作"});
  expect(summary).toHaveAttribute("aria-expanded","false");
  await openQuickActions(user);
  const actions=screen.getByRole("group",{name:"クイックアクション"});
  const resultsHeading=screen.getByRole("heading",{name:facilityCountText});
  expect(actions).toContainElement(screen.getByRole("button",{name:"施設を追加"}));
  expect(actions).toContainElement(screen.getByRole("button",{name:"JSONを保存"}));
  expect(actions.compareDocumentPosition(resultsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole("button",{name:"掲載されていない施設を追加"})).not.toBeInTheDocument();
 });
  it("opens the filtered facilities on the map and returns to the list",async()=>{
   const user=userEvent.setup();
   render(<App />);
   await user.click(screen.getByRole("button",{name:/施設を探す/}));
   await user.type(screen.getByRole("searchbox"),"上野");
   await user.click(screen.getByRole("button",{name:"地図で見る"}));
   expect(screen.getByRole("heading",{name:"施設マップ"})).toBeInTheDocument();
   expect(screen.getByText("1施設を表示")).toBeInTheDocument();
   expect(screen.getByText("恩賜上野動物園")).toBeInTheDocument();
   await user.click(screen.getByRole("button",{name:"← 施設一覧"}));
   expect(screen.getByText("1施設が該当")).toBeInTheDocument();
  });
  it("returns to the map in one tap after opening a detail from a map popup",async()=>{
   const user=userEvent.setup();
   render(<App visitStore={visitStore} />);
   await user.click(screen.getByRole("button",{name:"地図で見る"}));
   await user.click(screen.getByRole("button",{name:"詳細を見る"}));
   expect(screen.getByRole("button",{name:"← 地図に戻る"})).toBeInTheDocument();
   await user.click(screen.getByRole("button",{name:"← 地図に戻る"}));
   expect(screen.getByRole("heading",{name:"施設マップ"})).toBeInTheDocument();
   expect(screen.getByTestId("map-focus")).toHaveTextContent(facilitiesJson[0].id);
   expect(screen.getByText(`${facilitiesJson.length}施設を表示`)).toBeInTheDocument();
  });
  it("opens the focused facility on the map from its detail page",async()=>{
   const user=userEvent.setup();
   render(<App visitStore={visitStore} />);
   await user.click(screen.getByRole("link",{name:/札幌市円山動物園/}));
   await user.click(screen.getByRole("button",{name:"地図で場所を見る"}));
   expect(screen.getByRole("heading",{name:"施設マップ"})).toBeInTheDocument();
   expect(screen.getByTestId("map-focus")).toHaveTextContent("hokkaido_maruyama_zoo");
   expect(screen.getByText("1施設を表示")).toBeInTheDocument();
   expect(screen.getByText("札幌市円山動物園")).toBeInTheDocument();
  });
  it("opens the statistics view and returns to the facility list",async()=>{
   const user=userEvent.setup();
   render(<App visitStore={visitStore} />);
   await user.click(screen.getByRole("button",{name:"統計"}));
   expect(screen.getByRole("heading",{name:"記録の統計"})).toBeInTheDocument();
   await user.click(screen.getByRole("button",{name:"← 施設一覧"}));
   expect(screen.getByText(facilityCountText)).toBeInTheDocument();
  });
  it("keeps the statistics button disabled until visits are received",async()=>{
   const user=userEvent.setup();
   let emitVisits: ((visits: Visit[])=>void)|undefined;
   const loadingVisitStore: VisitStore={
    ...visitStore,
    subscribeAll:(onVisits)=>{ emitVisits=onVisits; return ()=>undefined; },
   };
   render(<App visitStore={loadingVisitStore} />);
   const button=screen.getByRole("button",{name:"統計"});
   expect(button).toBeDisabled();
   emitVisits?.([]);
   await waitFor(()=>expect(button).toBeEnabled());
   await user.click(button);
   expect(screen.getByRole("heading",{name:"記録の統計"})).toBeInTheDocument();
  });
  it("restores the list scroll position after returning from a facility detail",async()=>{
   const user=userEvent.setup();
   const scrollTo=vi.spyOn(window,"scrollTo").mockImplementation(()=>undefined);
   render(<App visitStore={visitStore} />);
   Object.defineProperty(window,"scrollY",{value:1200,writable:true,configurable:true});
   window.dispatchEvent(new Event("scroll"));
   await user.click(screen.getByRole("link",{name:/札幌市円山動物園/}));
   expect(scrollTo).toHaveBeenLastCalledWith({top:0,left:0,behavior:"instant"});
   await user.click(screen.getByRole("button",{name:/施設一覧/}));
   expect(scrollTo).toHaveBeenLastCalledWith({top:1200,left:0,behavior:"instant"});
  });
  it("restores the statistics view from the URL hash on reload",()=>{
   window.location.hash="#stats";
   render(<App visitStore={visitStore} />);
   expect(screen.getByRole("heading",{name:"記録の統計"})).toBeInTheDocument();
  });
  it("restores the map view with focus from the URL hash on reload",()=>{
   window.location.hash="#map/hokkaido_maruyama_zoo";
   render(<App visitStore={visitStore} />);
   expect(screen.getByRole("heading",{name:"施設マップ"})).toBeInTheDocument();
   expect(screen.getByTestId("map-focus")).toHaveTextContent("hokkaido_maruyama_zoo");
  });
  it("restores a facility detail from the URL hash on reload",()=>{
   window.location.hash="#facility/hokkaido_maruyama_zoo";
   render(<App visitStore={visitStore} />);
   expect(screen.getByRole("heading",{name:"札幌市円山動物園"})).toBeInTheDocument();
  });
  it("does not animate cards after returning from a detail restored from the URL hash",async()=>{
   window.history.replaceState(null,"",`${window.location.pathname}#facility/hokkaido_maruyama_zoo`);
   render(<App visitStore={visitStore} />);
   act(() => {
    window.history.replaceState(null, "", window.location.pathname);
    window.dispatchEvent(new PopStateEvent("popstate"));
   });
   await waitFor(() => expect(document.querySelector<HTMLElement>(".facility-list")).toBeInTheDocument());
   expect(document.querySelector<HTMLElement>(".facility-list")).not.toHaveClass("facility-list--animated");
  });
  it("restores a custom facility detail once custom facilities are loaded",async()=>{
   let emitCustomFacilities: ((facilities: typeof exportFacility[])=>void)|undefined;
   const loadingCustomFacilityStore: CustomFacilityStore={
    create:async()=>exportFacility,
    update:async()=>exportFacility,
    remove:async()=>undefined,
    subscribe:(onFacilities)=>{ emitCustomFacilities=onFacilities; return ()=>undefined; },
   };
   window.location.hash=`#facility/${exportFacility.id}`;
   render(<App visitStore={visitStore} customFacilityStore={loadingCustomFacilityStore} />);
   expect(screen.getByText(facilityCountText)).toBeInTheDocument();
   await waitFor(() => expect(emitCustomFacilities).toBeDefined());
   await act(async () => {
    emitCustomFacilities?.([exportFacility]);
   });
   expect(await screen.findByRole("heading",{name:exportFacility.name})).toBeInTheDocument();
  });
  it("falls back to the list and clears the hash for an unknown facility id",async()=>{
   window.location.hash="#facility/no_such_facility";
   render(<App visitStore={visitStore} />);
   expect(screen.getByText(facilityCountText)).toBeInTheDocument();
   await waitFor(()=>expect(window.location.hash).toBe(""));
  });
  it("writes the current view to the URL hash while navigating",async()=>{
   const user=userEvent.setup();
   render(<App visitStore={visitStore} />);
   await user.click(screen.getByRole("link",{name:/札幌市円山動物園/}));
   expect(window.location.hash).toBe("#facility/hokkaido_maruyama_zoo");
   await user.click(screen.getByRole("button",{name:"← 施設一覧"}));
   expect(window.location.hash).toBe("");
   await user.click(screen.getByRole("button",{name:"統計"}));
   expect(window.location.hash).toBe("#stats");
  });
});
