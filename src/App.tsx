import { useMemo, useState } from "react";
import facilitiesJson from "./data/facilities.json";
import { filterFacilities } from "./filterFacilities";
import type { Facility, FacilityType } from "./types";
const facilities=facilitiesJson as Facility[];
const filters:{value:FacilityType|"all";label:string}[]=[{value:"all",label:"すべて"},{value:"zoo",label:"動物園"},{value:"aquarium",label:"水族館"},{value:"both",label:"複合・その他"}];
const typeLabels:Record<FacilityType,string>={zoo:"動物園",aquarium:"水族館",both:"複合施設",other:"その他"};
export default function App(){
 const [query,setQuery]=useState(""); const [type,setType]=useState<FacilityType|"all">("all");
 const shown=useMemo(()=>filterFacilities(facilities,query,type),[query,type]);
 return <main className="app-shell">
  <header className="hero"><p className="eyebrow">FAMILY FIELD NOTE</p><h1>動物園・<br/>水族館ログ</h1><p className="lead">次は、どの生きものに会いに行こう？</p><span className="route" aria-hidden="true"/></header>
  <section className="controls" aria-label="施設を探す"><label htmlFor="search">施設を探す</label><div className="search-wrap"><span aria-hidden="true">⌕</span><input id="search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="施設名・都道府県で検索"/></div><div className="filters">{filters.map(item=><button key={item.value} className={type===item.value?"active":""} aria-pressed={type===item.value} onClick={()=>setType(item.value)}>{item.label}</button>)}</div></section>
  <section className="results"><div className="results-heading"><h2>{query||type!=="all"?`${shown.length}施設が該当`:`${facilities.length}施設を掲載`}</h2><p>パイロット版</p></div>{shown.length===0?<div className="empty"><span>◌</span><h3>施設が見つかりませんでした</h3><p>検索語や種別を変えてみてください。</p></div>:<ul className="facility-list">{shown.map((f,index)=><li key={f.id} className="facility-card"><div className="card-index">{String(index+1).padStart(2,"0")}</div><div className="card-body"><div className="badges"><span>{typeLabels[f.type]}</span><span className="open">営業中</span></div><h3>{f.name}</h3><p>{f.pref} {f.city}</p><a href={f.url} target="_blank" rel="noreferrer">公式サイトを見る <span aria-hidden="true">↗</span></a></div></li>)}</ul>}</section>
  <footer><p>掲載情報の確認日：2026年7月13日</p></footer>
 </main>;
}
