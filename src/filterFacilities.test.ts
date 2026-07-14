import { describe, expect, it } from "vitest";
import { filterFacilities } from "./filterFacilities";
import type { Facility } from "./types";
const fixtures = [
 { id:"tokyo_ueno_zoo",name:"恩賜上野動物園",kana:"おんしうえのどうぶつえん",pref:"東京都",city:"台東区",type:"zoo",lat:0,lng:0,url:"https://example.com",sourceUrls:["https://example.com"],status:"open",lastVerifiedAt:"2026-07-13" },
 { id:"osaka_kaiyukan",name:"海遊館",kana:"かいゆうかん",pref:"大阪府",city:"大阪市",type:"aquarium",lat:0,lng:0,url:"https://example.com",sourceUrls:["https://example.com"],status:"open",lastVerifiedAt:"2026-07-13" }
] satisfies Facility[];
describe("filterFacilities",()=>{
 it("searches names, kana and regions",()=>{ expect(filterFacilities(fixtures,"うえの","all")).toHaveLength(1); expect(filterFacilities(fixtures,"東京都","all")).toHaveLength(1); });
 it("filters by type",()=>expect(filterFacilities(fixtures,"","aquarium")).toEqual([fixtures[1]]));
 it("filters by prefecture",()=>expect(filterFacilities(fixtures,"","all","東京都")).toEqual([fixtures[0]]));
 it("returns an empty list when nothing matches",()=>expect(filterFacilities(fixtures,"存在しない","all")).toEqual([]));
});
