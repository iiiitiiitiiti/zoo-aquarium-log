import { useMemo, useState } from "react";
import facilitiesJson from "./data/facilities.json";
import { filterFacilities } from "./filterFacilities";
import type { Facility, FacilityType } from "./types";
import type { VisitPhotoStore } from "./visitPhotos";
import type { VisitStore } from "./visits";
import VisitPanel from "./VisitPanel";

const facilities = facilitiesJson as Facility[];
const filters: { value: FacilityType | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "zoo", label: "動物園" },
  { value: "aquarium", label: "水族館" },
  { value: "both", label: "複合・その他" },
];
const typeLabels: Record<FacilityType, string> = {
  zoo: "動物園",
  aquarium: "水族館",
  both: "複合施設",
  other: "その他",
};

export default function App({
  visitStore,
  photoStore,
  onSignOut,
  signingOut = false,
  signOutError = "",
}: {
  visitStore?: VisitStore;
  photoStore?: VisitPhotoStore;
  onSignOut?: () => Promise<void>;
  signingOut?: boolean;
  signOutError?: string;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<FacilityType | "all">("all");
  const [selectedFacility, setSelectedFacility] = useState<Facility>();
  const shown = useMemo(
    () => filterFacilities(facilities, query, type),
    [query, type],
  );

  if (selectedFacility && visitStore) {
    return (
      <VisitPanel
        facility={selectedFacility}
        store={visitStore}
        photoStore={photoStore}
        onBack={() => setSelectedFacility(undefined)}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero-session">
          <p className="eyebrow">FAMILY FIELD NOTE</p>
          {onSignOut && (
            <button
              className="session-button"
              type="button"
              onClick={onSignOut}
              disabled={signingOut}
            >
              {signingOut ? "終了中…" : "ログアウト"}
            </button>
          )}
        </div>
        {signOutError && <p className="session-error" role="alert">{signOutError}</p>}
        <h1>動物園・<br />水族館ログ</h1>
        <p className="lead">次は、どの生きものに会いに行こう？</p>
        <span className="route" aria-hidden="true" />
      </header>
      <section className="controls" aria-label="施設を探す">
        <label htmlFor="search">施設を探す</label>
        <div className="search-wrap">
          <span aria-hidden="true">⌕</span>
          <input
            id="search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="施設名・都道府県で検索"
          />
        </div>
        <div className="filters">
          {filters.map((item) => (
            <button
              key={item.value}
              className={type === item.value ? "active" : ""}
              aria-pressed={type === item.value}
              onClick={() => setType(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>
      <section className="results">
        <div className="results-heading">
          <h2>{query || type !== "all" ? `${shown.length}施設が該当` : `${facilities.length}施設を掲載`}</h2>
          <p>パイロット版</p>
        </div>
        {shown.length === 0 ? (
          <div className="empty">
            <span>◌</span>
            <h3>施設が見つかりませんでした</h3>
            <p>検索語や種別を変えてみてください。</p>
          </div>
        ) : (
          <ul className="facility-list">
            {shown.map((facility, index) => (
              <li key={facility.id}>
                <a
                  className="facility-card"
                  href={"#facility/" + facility.id}
                  onClick={(event) => {
                    event.preventDefault();
                    setSelectedFacility(facility);
                  }}
                >
                  <div className="card-index">{String(index + 1).padStart(2, "0")}</div>
                  <div className="card-body">
                    <div className="badges">
                      <span>{typeLabels[facility.type]}</span>
                      <span className="open">営業中</span>
                    </div>
                    <h3>{facility.name}</h3>
                    <p>{facility.pref} {facility.city}</p>
                  </div>
                  <span className="card-arrow" aria-hidden="true">→</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <footer><p>掲載情報の確認日：2026年7月13日</p></footer>
    </main>
  );
}
