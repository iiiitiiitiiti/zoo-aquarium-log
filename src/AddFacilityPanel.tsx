import { type FormEvent, useState } from "react";
import type { CustomFacilityDraft, CustomFacilityStore } from "./customFacilities";
import { prefectureCoordinates, prefectures } from "./prefectures";
import type { Facility, FacilityType } from "./types";

interface FacilityFormState {
  name: string;
  kana: string;
  pref: string;
  city: string;
  type: FacilityType;
  status: Facility["status"];
  url: string;
  lat: number;
  lng: number;
  lastVerifiedAt: string;
}

const typeOptions: { value: FacilityType; label: string }[] = [
  { value: "zoo", label: "動物園" },
  { value: "aquarium", label: "水族館" },
  { value: "both", label: "複合施設" },
  { value: "other", label: "その他" },
];
const statusOptions: { value: Facility["status"]; label: string }[] = [
  { value: "open", label: "営業中" },
  { value: "suspended", label: "休園中" },
  { value: "closed", label: "閉園済み" },
];

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function initialState(initialFacility?: Facility): FacilityFormState {
  if (initialFacility) {
    return {
      name: initialFacility.name,
      kana: initialFacility.kana,
      pref: initialFacility.pref,
      city: initialFacility.city,
      type: initialFacility.type,
      status: initialFacility.status,
      url: initialFacility.url,
      lat: initialFacility.lat,
      lng: initialFacility.lng,
      lastVerifiedAt: initialFacility.lastVerifiedAt,
    };
  }
  const pref = "東京都";
  const coordinates = prefectureCoordinates(pref) ?? { lat: 35.6895, lng: 139.6917 };
  return {
    name: "",
    kana: "",
    pref,
    city: "",
    type: "zoo",
    status: "open",
    url: "",
    ...coordinates,
    lastVerifiedAt: today(),
  };
}

function sourceUrl(form: FacilityFormState) {
  if (form.url.trim()) return form.url.trim();
  const query = [form.name.trim(), form.pref, form.city.trim()].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function AddFacilityPanel({
  store,
  initialFacility,
  onCreated,
  onBack,
}: {
  store: CustomFacilityStore;
  initialFacility?: Facility;
  onCreated: (facility: Facility) => void;
  onBack: () => void;
}) {
  const [form, setForm] = useState(() => initialState(initialFacility));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updatePref(pref: string) {
    const coordinates = prefectureCoordinates(pref);
    setForm((current) => ({
      ...current,
      pref,
      ...(initialFacility || !coordinates ? {} : coordinates),
    }));
  }

  function useCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setForm((current) => ({ ...current, lat: coords.latitude, lng: coords.longitude })),
      () => undefined,
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const name = form.name.trim();
    if (!name) {
      setError("施設名を入力してください");
      return;
    }
    if (name.length > 200) {
      setError("施設名は200文字以内で入力してください");
      return;
    }
    if (form.kana.trim().length > 200 || form.city.trim().length > 100 || form.url.trim().length > 1000) {
      setError("入力内容が長すぎます。文字数を確認してください");
      return;
    }
    if (!form.pref) {
      setError("都道府県を選択してください");
      return;
    }

    const draft: CustomFacilityDraft = {
      name,
      kana: form.kana.trim(),
      pref: form.pref,
      city: form.city.trim(),
      type: form.type,
      lat: form.lat,
      lng: form.lng,
      url: form.url.trim(),
      sourceUrls: [sourceUrl(form)],
      status: form.status,
      lastVerifiedAt: form.lastVerifiedAt,
    };
    setError("");
    setSaving(true);
    try {
      const facility = initialFacility
        ? await store.update(initialFacility.id, draft)
        : await store.create(draft);
      onCreated(facility);
    } catch {
      setError("施設を保存できませんでした。もう一度お試しください");
    } finally {
      setSaving(false);
    }
  }

  const canUseLocation = typeof navigator !== "undefined" && Boolean(navigator.geolocation);

  return (
    <main className="app-shell detail-shell">
      <header className="detail-hero">
        <button className="back-button" type="button" onClick={onBack}>← 施設一覧</button>
        <p className="eyebrow">FACILITY FIELD NOTE</p>
        <h1>{initialFacility ? "施設を編集" : "施設を追加"}</h1>
        <p>掲載されていない施設を家族の記録に追加します。</p>
      </header>
      <section className="visit-section" aria-labelledby="facility-form-heading">
        <div className="visit-heading">
          <div>
            <p>MY PLACE</p>
            <h2 id="facility-form-heading">施設情報</h2>
          </div>
        </div>
        {error && <p className="visit-error" role="alert">{error}</p>}
        <form className="visit-form" onSubmit={save} noValidate>
          <label>
            施設名
            <input
              type="text"
              value={form.name}
              maxLength={200}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </label>
          <label>
            ふりがな
            <input
              type="text"
              value={form.kana}
              maxLength={200}
              onChange={(event) => setForm({ ...form, kana: event.target.value })}
            />
          </label>
          <div className="form-row">
            <label>
              都道府県
              <select value={form.pref} onChange={(event) => updatePref(event.target.value)} required>
                <option value="">選択してください</option>
                {prefectures.map((prefecture) => (
                  <option key={prefecture.name} value={prefecture.name}>{prefecture.name}</option>
                ))}
              </select>
            </label>
            <label>
              市区町村
              <input
                type="text"
                value={form.city}
                maxLength={100}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              種別
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as FacilityType })}>
                {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              営業状態
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Facility["status"] })}>
                {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
          <label>
            公式サイト URL
            <input
              type="url"
              value={form.url}
              maxLength={1000}
              onChange={(event) => setForm({ ...form, url: event.target.value })}
              placeholder="任意。未入力ならGoogleマップ検索を保存"
            />
          </label>
          {canUseLocation && (
            <button className="location-button" type="button" onClick={useCurrentLocation}>現在地を使う</button>
          )}
          <p className="location-note">位置情報は{form.pref}の県庁所在地を初期値にしています。</p>
          <div className="form-actions">
            <button className="secondary" type="button" onClick={onBack}>キャンセル</button>
            <button type="submit" disabled={saving}>{saving ? "保存しています…" : initialFacility ? "変更を保存" : "施設を保存"}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
