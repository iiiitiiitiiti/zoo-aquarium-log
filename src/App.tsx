import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AddFacilityPanel from "./AddFacilityPanel";
import { buildExport, buildExportFilename } from "./buildExport";
import MapPanel from "./MapPanel";
import facilitiesJson from "./data/facilities.json";
import { filterFacilities, type VisitStatusFilter } from "./filterFacilities";
import StatsPanel from "./StatsPanel";
import { swUpdate } from "./swUpdate";
import { buildStats } from "./stats";
import type { CustomFacilityStore } from "./customFacilities";
import type { FacilityNoteMap, FacilityNoteStore } from "./facilityNotes";
import type { MarkFlag, MarkMap, MarkStore } from "./marks";
import { buildRouteHash, parseRouteHash, routesEqual, type Route } from "./route";
import type { Facility, FacilityType } from "./types";
import type { VisitPhotoStore } from "./visitPhotos";
import type { Visit, VisitStore } from "./visits";
import VisitPanel from "./VisitPanel";
import "./app-map.css";

const facilities = facilitiesJson as Facility[];
const filters: { value: FacilityType | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "zoo", label: "動物園" },
  { value: "aquarium", label: "水族館" },
  { value: "both", label: "複合・その他" },
];
const statusFilters: { value: Facility["status"] | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "open", label: "営業中" },
  { value: "suspended", label: "休園中" },
  { value: "closed", label: "閉園済み" },
];
const visitStatusFilters: { value: VisitStatusFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "visited", label: "訪問済み" },
  { value: "unvisited", label: "未訪問" },
  { value: "wishlist", label: "行きたい" },
  { value: "favorite", label: "お気に入り" },
];
const statusLabels: Record<Facility["status"], string> = {
  open: "営業中",
  suspended: "休園中",
  closed: "閉園済み",
};
const typeLabels: Record<FacilityType, string> = {
  zoo: "動物園",
  aquarium: "水族館",
  both: "複合施設",
  other: "その他",
};
type MapDisplayMode = "all" | "facility";
const APP_MAP_FOCUS_KEY = "__zooAquariumLogMapFocus";

export default function App({
  visitStore,
  photoStore,
  markStore,
  customFacilityStore,
  facilityNoteStore,
  onSignOut,
  signingOut = false,
  signOutError = "",
}: {
  visitStore?: VisitStore;
  photoStore?: VisitPhotoStore;
  markStore?: MarkStore;
  customFacilityStore?: CustomFacilityStore;
  facilityNoteStore?: FacilityNoteStore;
  onSignOut?: () => Promise<void>;
  signingOut?: boolean;
  signOutError?: string;
}) {
  // リロード時に URL ハッシュから表示中の画面を復元する（カスタム施設は
  // 読み込み完了までpendingRouteとして保留し、後続のeffectで解決する）
  const [initialRoute] = useState<Route>(() => parseRouteHash(typeof window === "undefined" ? "" : window.location.hash));
  const [query, setQuery] = useState("");
  const [type, setType] = useState<FacilityType | "all">("all");
  const [prefecture, setPrefecture] = useState("all");
  const [status, setStatus] = useState<Facility["status"] | "all">("all");
  const [visitStatus, setVisitStatus] = useState<VisitStatusFilter>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(initialRoute.view === "map");
  const [statsOpen, setStatsOpen] = useState(initialRoute.view === "stats");
  const [mapDisplayMode, setMapDisplayMode] = useState<MapDisplayMode>(
    initialRoute.view === "map" && initialRoute.focusFacilityId ? "facility" : "all",
  );
  const [detailOrigin, setDetailOrigin] = useState<"list" | "map">("list");
  const [mapFocusFacilityId, setMapFocusFacilityId] = useState<string | undefined>(
    initialRoute.view === "map" ? initialRoute.focusFacilityId : undefined,
  );
  const [selectedFacility, setSelectedFacility] = useState<Facility | undefined>(() =>
    initialRoute.view === "facility"
      ? facilities.find((facility) => facility.id === initialRoute.facilityId)
      : undefined);
  const [facilityEditorOpen, setFacilityEditorOpen] = useState(initialRoute.view === "addFacility");
  const [editingFacility, setEditingFacility] = useState<Facility>();
  const [visitEditing, setVisitEditing] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<Route | undefined>(() => {
    if (initialRoute.view === "facility" && !facilities.some((facility) => facility.id === initialRoute.facilityId)) {
      return initialRoute;
    }
    if (initialRoute.view === "editFacility") return initialRoute;
    return undefined;
  });
  const [visits, setVisits] = useState<Visit[]>();
  const [visitError, setVisitError] = useState("");
  const [marks, setMarks] = useState<MarkMap>();
  const [marksError, setMarksError] = useState("");
  const [markActionError, setMarkActionError] = useState("");
  const [savingMarkKeys, setSavingMarkKeys] = useState<Set<string>>(() => new Set());
  const [notes, setNotes] = useState<FacilityNoteMap>();
  const [notesError, setNotesError] = useState("");
  const [customFacilities, setCustomFacilities] = useState<Facility[]>();
  const [customFacilitiesError, setCustomFacilitiesError] = useState("");
  const listScrollYRef = useRef(0);
  const replaceNextRouteRef = useRef(false);
  const [animateListCards, setAnimateListCards] = useState(initialRoute.view === "list");

  useEffect(() => {
    swUpdate.setEditing(facilityEditorOpen || visitEditing);
  }, [facilityEditorOpen, visitEditing]);

  useEffect(() => {
    if (!visitStore) {
      setVisits([]);
      setVisitError("");
      return;
    }
    setVisitError("");
    setVisits(undefined);
    return visitStore.subscribeAll(
      setVisits,
      () => setVisitError("記録を読み込めませんでした。通信環境を確認してください"),
    );
  }, [visitStore]);

  useEffect(() => {
    if (!markStore) {
      setMarks({});
      setMarksError("");
      return;
    }
    setMarksError("");
    setMarks(undefined);
    return markStore.subscribe(setMarks, () => setMarksError("お気に入り設定を読み込めませんでした。通信環境を確認してください"));
  }, [markStore]);

  useEffect(() => {
    if (!facilityNoteStore) {
      setNotes({});
      setNotesError("");
      return;
    }
    setNotes(undefined);
    setNotesError("");
    return facilityNoteStore.subscribe(
      setNotes,
      () => setNotesError("施設メモを読み込めませんでした。通信環境を確認してください"),
    );
  }, [facilityNoteStore]);

  useEffect(() => {
    if (!customFacilityStore) {
      setCustomFacilities([]);
      setCustomFacilitiesError("");
      return;
    }
    setCustomFacilities(undefined);
    setCustomFacilitiesError("");
    return customFacilityStore.subscribe(
      setCustomFacilities,
      () => setCustomFacilitiesError("手動追加施設を読み込めませんでした。通信環境を確認してください"),
    );
  }, [customFacilityStore]);

  const allFacilities = useMemo(() => [...facilities, ...(customFacilities ?? [])], [customFacilities]);

  useEffect(() => {
    if (!pendingRoute) return;
    // カスタム施設の読み込みが終わる（またはエラーで確定する）まで保留する
    if (customFacilityStore && customFacilities === undefined && !customFacilitiesError) return;
    const facilityId = pendingRoute.view === "facility" || pendingRoute.view === "editFacility"
      ? pendingRoute.facilityId
      : undefined;
    const facility = facilityId ? allFacilities.find((item) => item.id === facilityId) : undefined;
    if (facility && pendingRoute.view === "facility") {
      setSelectedFacility(facility);
    } else if (facility && pendingRoute.view === "editFacility" && facility.id.startsWith("custom_")) {
      setEditingFacility(facility);
      setFacilityEditorOpen(true);
    }
    setPendingRoute(undefined);
  }, [pendingRoute, allFacilities, customFacilities, customFacilitiesError, customFacilityStore]);
  const prefectures = useMemo(
    () => [...new Set(allFacilities.map((facility) => facility.pref))],
    [allFacilities],
  );
  const visitedIds = useMemo(
    () => new Set((visits ?? []).map((visit) => visit.facilityId)),
    [visits],
  );
  const shown = useMemo(
    () => filterFacilities(allFacilities, query, type, prefecture, status, {
      filter: visitStatus,
      visitedIds,
      marks: marks ?? {},
    }),
    [allFacilities, query, type, prefecture, status, visitStatus, visitedIds, marks],
  );
  const prefectureGroups = useMemo(() => {
    const groups = new Map<string, { facility: Facility; index: number }[]>();
    shown.forEach((facility, index) => {
      const group = groups.get(facility.pref) ?? [];
      group.push({ facility, index });
      groups.set(facility.pref, group);
    });
    return [...groups.entries()];
  }, [shown]);
  const mapShown = useMemo(() => {
    if (mapDisplayMode !== "facility" || !mapFocusFacilityId) return shown;
    const focusedFacility = shown.find((facility) => facility.id === mapFocusFacilityId);
    return focusedFacility ? [focusedFacility] : shown;
  }, [mapDisplayMode, mapFocusFacilityId, shown]);
  const stats = useMemo(() => buildStats(allFacilities, visits ?? []), [allFacilities, visits]);
  const activeFilterCount = [
    query.trim(),
    type !== "all",
    prefecture !== "all",
    status !== "all",
    visitStatus !== "all",
  ].filter(Boolean).length;
  const hasListFilter = activeFilterCount > 0;
  const statusFiltersLoading = Boolean(visitStore && visits === undefined)
    || Boolean(markStore && marks === undefined);
  const mapNotReady = Boolean(
    (visitStore && visits === undefined)
    || (markStore && marks === undefined)
    || (customFacilityStore && customFacilities === undefined)
    || visitError
    || marksError
    || customFacilitiesError
  );
  const exportNotReady = Boolean(
    (visitStore && visits === undefined)
    || (markStore && marks === undefined)
    || (customFacilityStore && customFacilities === undefined)
    || (facilityNoteStore && notes === undefined)
    || visitError
    || marksError
    || customFacilitiesError
    || notesError
    || typeof URL === "undefined"
    || typeof URL.createObjectURL !== "function",
  );

  const statsNotReady = Boolean(
    (visitStore && visits === undefined)
    || (customFacilityStore && customFacilities === undefined)
    || visitError
    || customFacilitiesError,
  );

  // ブラウザの戻る・進むで変わったURLハッシュをReactの表示状態へ反映する。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncRouteFromHistory = () => {
      replaceNextRouteRef.current = false;
      const route = parseRouteHash(window.location.hash);
      setVisitEditing(false);
      const mapFocusFromHistory = route.view === "map"
        && window.history.state
        && typeof window.history.state === "object"
        && typeof (window.history.state as Record<string, unknown>)[APP_MAP_FOCUS_KEY] === "string"
        ? (window.history.state as Record<string, unknown>)[APP_MAP_FOCUS_KEY] as string
        : undefined;
      setMapOpen(route.view === "map");
      setStatsOpen(route.view === "stats");
      setMapDisplayMode(route.view === "map" && route.focusFacilityId ? "facility" : "all");
      setMapFocusFacilityId(route.view === "map" ? route.focusFacilityId ?? mapFocusFromHistory : undefined);
      setFacilityEditorOpen(route.view === "addFacility");
      setEditingFacility(undefined);
      setSelectedFacility(undefined);
      setDetailOrigin("list");
      if (route.view === "facility" || route.view === "editFacility") {
        setPendingRoute(route);
      } else {
        setPendingRoute(undefined);
      }
    };
    window.addEventListener("popstate", syncRouteFromHistory);
    return () => window.removeEventListener("popstate", syncRouteFromHistory);
  }, []);

  // 表示中の画面を URL ハッシュへ反映する（レンダー分岐と同じ優先順で判定）。
  // 統計画面内アンカー（#stats-type 等）は同一ルートなので書き換えない。
  const currentRoute: Route = mapOpen
    ? { view: "map", focusFacilityId: mapDisplayMode === "facility" ? mapFocusFacilityId : undefined }
    : statsOpen
      ? { view: "stats" }
      : facilityEditorOpen && customFacilityStore
        ? editingFacility
          ? { view: "editFacility", facilityId: editingFacility.id }
          : { view: "addFacility" }
        : selectedFacility && visitStore
          ? { view: "facility", facilityId: selectedFacility.id }
          : { view: "list" };
  const desiredHash = buildRouteHash(pendingRoute ?? currentRoute);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (routesEqual(parseRouteHash(window.location.hash), parseRouteHash(desiredHash))) return;
    const url = `${window.location.pathname}${window.location.search}${desiredHash}`;


    if (replaceNextRouteRef.current) {
      replaceNextRouteRef.current = false;
      window.history.replaceState(window.history.state, "", url);
      return;
    }
    window.history.pushState({ ...(window.history.state ?? {}) }, "", url);
  }, [desiredHash]);

  const handleVisitEditingChange = useCallback((editing: boolean) => {
    setVisitEditing(editing);
  }, []);

  // 一覧のスクロール位置を保存し、詳細・地図・統計から戻ったときに復元する。
  // 他画面へ入るときは先頭から表示する（stats.css の scroll-behavior:smooth を
  // 避けるため instant で移動する）
  const currentView = currentRoute.view;
  useEffect(() => {
    if (typeof window === "undefined" || currentView !== "list") return;
    const saveListScroll = () => {
      listScrollYRef.current = window.scrollY;
    };
    window.addEventListener("scroll", saveListScroll, { passive: true });
    return () => window.removeEventListener("scroll", saveListScroll);
  }, [currentView]);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.scrollTo !== "function") return;
    window.scrollTo({ top: currentView === "list" ? listScrollYRef.current : 0, left: 0, behavior: "instant" });
  }, [currentView]);
  useEffect(() => {
    if (currentView !== "list") setAnimateListCards(false);
  }, [currentView]);

  const resetFilters = () => {
    setQuery("");
    setType("all");
    setPrefecture("all");
    setStatus("all");
    setVisitStatus("all");
  };

  const toggleFacilityMark = async (facilityId: string, flag: MarkFlag) => {
    if (!markStore) return;
    const key = `${facilityId}:${flag}`;
    if (savingMarkKeys.has(key)) return;
    const currentValue = marks?.[facilityId]?.[flag] === true;
    setMarkActionError("");
    setSavingMarkKeys((current) => new Set(current).add(key));
    try {
      await markStore.setFlag(facilityId, flag, !currentValue);
    } catch {
      setMarkActionError("マーク設定を保存できませんでした。もう一度お試しください");
    } finally {
      setSavingMarkKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const scrollToTop = () => {
    if (typeof window === "undefined" || typeof window.scrollTo !== "function") return;
    const prefersReducedMotion = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, left: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  };

  const openAddFacility = () => {
    setVisitEditing(false);
    setSelectedFacility(undefined);
    setEditingFacility(undefined);
    setFacilityEditorOpen(true);
  };

  const openFacility = (facility: Facility, origin: "list" | "map" = "list") => {
    if (origin === "map" && typeof window !== "undefined") {
      window.history.replaceState(
        { ...(window.history.state ?? {}), [APP_MAP_FOCUS_KEY]: facility.id },
        "",
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      );
    }
    setVisitEditing(false);
    setFacilityEditorOpen(false);
    setMapOpen(false);
    setMapDisplayMode("all");
    setMapFocusFacilityId(origin === "map" ? facility.id : undefined);
    setDetailOrigin(origin);
    setSelectedFacility(facility);
  };

  const downloadExport = () => {
    if (exportNotReady || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return;
    const data = buildExport(visits ?? [], marks ?? {}, customFacilities ?? [], notes ?? {});
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = buildExportFilename();
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    if (typeof URL.revokeObjectURL === "function") {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    }
  };

  const goBack = (fallback: () => void) => {

    replaceNextRouteRef.current = true;
    fallback();
  };

  if (mapOpen) {
    return (
      <MapPanel
        shown={mapShown}
        visitedIds={visitedIds}
        marks={marks ?? {}}
        focusedFacilityId={mapFocusFacilityId}
        onBack={() => goBack(() => {
          setMapOpen(false);
          setMapDisplayMode("all");
          setMapFocusFacilityId(undefined);
        })}
        onSelectFacility={(facility) => openFacility(facility, "map")}
      />
    );
  }

  if (statsOpen) {
    return <StatsPanel stats={stats} onBack={() => goBack(() => setStatsOpen(false))} />;
  }

  if (facilityEditorOpen && customFacilityStore) {
    return (
      <AddFacilityPanel
        store={customFacilityStore}
        initialFacility={editingFacility}
        onBack={() => goBack(() => {
          setFacilityEditorOpen(false);
          setEditingFacility(undefined);
        })}
        onCreated={(facility) => {
          setFacilityEditorOpen(false);
          setEditingFacility(undefined);
          setSelectedFacility(facility);
        }}
      />
    );
  }

  if (selectedFacility && visitStore) {
    const selectedVisits = visits?.filter((visit) => visit.facilityId === selectedFacility.id) ?? [];
    return (
      <VisitPanel
        facility={selectedFacility}
        store={visitStore}
        visits={selectedVisits}
        visitsLoading={visits === undefined}
        visitError={visitError}
        photoStore={photoStore}
        mark={marks?.[selectedFacility.id]}
        markStore={markStore}
        markLoadError={marksError}
        note={notes?.[selectedFacility.id]}
        noteStore={facilityNoteStore}
        notesLoading={facilityNoteStore !== undefined && notes === undefined}
        noteLoadError={notesError}
        customFacilityStore={customFacilityStore}
        backLabel={detailOrigin === "map" ? "← 地図に戻る" : "← 施設一覧"}
        onEditingChange={handleVisitEditingChange}
        onShowOnMap={() => {
          setVisitEditing(false);
          setSelectedFacility(undefined);
          setMapDisplayMode("facility");
          setMapFocusFacilityId(selectedFacility.id);
          setMapOpen(true);
        }}
        onEditFacility={selectedFacility.id.startsWith("custom_") && customFacilityStore
          ? () => {
            setEditingFacility(selectedFacility);
            setSelectedFacility(undefined);
            setFacilityEditorOpen(true);
          }
          : undefined}
        onBack={() => goBack(() => {
          setVisitEditing(false);
          setSelectedFacility(undefined);
          if (detailOrigin === "map") setMapOpen(true);
        })}
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
      <section className={`controls ${searchOpen ? "is-open" : ""}`} aria-label="施設を探す">
        <button
          className="controls-summary"
          type="button"
          aria-expanded={searchOpen}
          aria-controls="facility-search-controls"
          onClick={() => setSearchOpen((isOpen) => !isOpen)}
        >
          <span className="controls-title">施設を探す</span>
          <span className="controls-meta">{activeFilterCount > 0 ? `${activeFilterCount}件の条件` : "検索・絞り込み"}</span>
        </button>
        <div id="facility-search-controls" className="controls-body" aria-hidden={!searchOpen}>
          <label htmlFor="search">キーワード検索</label>
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
          <div className="filter-group prefecture-filter">
            <label className="filter-group-label" htmlFor="prefecture">都道府県</label>
            <select
              id="prefecture"
              value={prefecture}
              onChange={(event) => setPrefecture(event.target.value)}
            >
              <option value="all">すべて</option>
              {prefectures.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-group-label">種別</span>
            <div className="filters" role="group" aria-label="種別">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={type === item.value ? "active" : ""}
                  aria-pressed={type === item.value}
                  onClick={() => setType(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <span className="filter-group-label">営業状態</span>
            <div className="filters" role="group" aria-label="営業状態">
              {statusFilters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={status === item.value ? "active" : ""}
                  aria-pressed={status === item.value}
                  onClick={() => setStatus(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <span className="filter-group-label">訪問状況</span>
            <div className="filters" role="group" aria-label="訪問状況">
              {visitStatusFilters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={visitStatus === item.value ? "active" : ""}
                  aria-pressed={visitStatus === item.value}
                  disabled={item.value !== "all" && statusFiltersLoading}
                  onClick={() => setVisitStatus(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <button className="filter-reset" type="button" onClick={resetFilters} disabled={activeFilterCount === 0}>条件をリセット</button>
        </div>
      </section>
      <section className={`quick-actions ${quickActionsOpen ? "is-open" : ""}`} aria-label="その他の操作">
        <button
          className="quick-actions-summary"
          type="button"
          aria-expanded={quickActionsOpen}
          aria-controls="quick-actions-body"
          onClick={() => setQuickActionsOpen((isOpen) => !isOpen)}
        >
          <span>その他の操作</span>
        </button>
        <div id="quick-actions-body" className="quick-actions-body" aria-hidden={!quickActionsOpen}>
          <div className="quick-actions-buttons" role="group" aria-label="クイックアクション">
            {customFacilityStore && (
              <button className="quick-action" type="button" onClick={openAddFacility}>施設を追加</button>
            )}
            <button className="quick-action" type="button" onClick={downloadExport} disabled={exportNotReady}>JSONを保存</button>
          </div>
          <p className="location-note export-note">写真データは含まれません。訪問日・メモ・評価・行きたい/お気に入り・手動追加した施設情報が対象です。</p>
          <p className="app-version">バージョン {__APP_VERSION__}</p>
        </div>
      </section>
      <section className="results">
        <div className="results-heading">
          <h2>{hasListFilter ? `${shown.length}施設が該当` : `${allFacilities.length}施設を掲載`}</h2>
          <div className="results-heading-side">
            <div className="results-heading-actions">
              <button className="stats-toggle" type="button" onClick={() => setStatsOpen(true)} disabled={statsNotReady}>統計</button>
              <button className="map-toggle" type="button" onClick={() => {
                setMapDisplayMode("all");
                setMapFocusFacilityId(undefined);
                setMapOpen(true);
              }} disabled={mapNotReady}>地図で見る</button>
            </div>
          </div>
        </div>
        {markActionError && <p className="mark-action-error" role="alert">{markActionError}</p>}
        {shown.length === 0 ? (
          <div className="empty">
            <span>◌</span>
            <h3>施設が見つかりませんでした</h3>
            <p>検索条件を変えてみてください。</p>
          </div>
        ) : (
          <div className="prefecture-groups">
            {prefectureGroups.map(([prefectureName, group]) => (
              <section className="prefecture-group" key={prefectureName}>
                <h3 className="prefecture-heading">{prefectureName}</h3>
                <ul className={`facility-list${animateListCards ? " facility-list--animated" : ""}`}>
                  {group.map(({ facility, index }) => (
                    <li key={facility.id}>
                      <div className="facility-card">
                        <a
                          className="facility-card-link"
                          href={`#facility/${facility.id}`}
                          onClick={(event) => {
                            event.preventDefault();
                            openFacility(facility);
                          }}
                        >
                          <div className="card-index">{String(index + 1).padStart(2, "0")}</div>
                          <div className="card-body">
                            <div className="badges">
                              <span className={facility.type}>{typeLabels[facility.type]}</span>
                              {facility.id.startsWith("custom_") && <span className="custom">手動追加</span>}
                              <span className={facility.status}>{statusLabels[facility.status]}</span>
                            </div>
                            <h3>{facility.name}</h3>
                            <p>{facility.pref} {facility.city}</p>
                          </div>
                          <span className="card-arrow" aria-hidden="true">→</span>
                        </a>
                        {markStore && (
                          <div className="facility-card-actions" role="group" aria-label={`${facility.name}のマーク`}>
                            <button
                              type="button"
                              aria-label={`${facility.name}${marks?.[facility.id]?.wishlist === true ? "の行きたいを解除" : "を行きたいに設定"}`}
                              aria-pressed={marks?.[facility.id]?.wishlist === true}
                              disabled={marks === undefined || savingMarkKeys.has(`${facility.id}:wishlist`)}
                              onClick={() => { void toggleFacilityMark(facility.id, "wishlist"); }}
                            >♡ 行きたい</button>
                            <button
                              type="button"
                              aria-label={`${facility.name}${marks?.[facility.id]?.favorite === true ? "のお気に入りを解除" : "をお気に入りに設定"}`}
                              aria-pressed={marks?.[facility.id]?.favorite === true}
                              disabled={marks === undefined || savingMarkKeys.has(`${facility.id}:favorite`)}
                              onClick={() => { void toggleFacilityMark(facility.id, "favorite"); }}
                            >★ お気に入り</button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
      <footer><p>掲載情報の確認日：2026年7月13日</p></footer>
      <button className="back-to-top" type="button" onClick={scrollToTop} aria-label="ページの先頭へ戻る">
        <span aria-hidden="true">↑</span>
      </button>
    </main>
  );
}
