import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import type { CustomFacilityStore } from "./customFacilities";
import { MAX_FACILITY_NOTE_LENGTH, type FacilityNote, type FacilityNoteStore } from "./facilityNotes";
import type { Mark, MarkFlag, MarkStore } from "./marks";
import type { Facility } from "./types";
import type { VisitPhotoStore } from "./visitPhotos";
import type { Visit, VisitDraft, VisitStore } from "./visits";

const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;

interface VisitFormState {
  id: string;
  editing: boolean;
  date: string;
  rating: string;
  memo: string;
  visitor: string;
  photoPath?: string;
  originalPhotoPath?: string;
  photoFile?: File;
  photoPreviewUrl?: string;
  removePhoto: boolean;
}

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function displayDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return year + "年" + month + "月" + day + "日";
}

function displayNoteUpdatedAt(note: FacilityNote) {
  if (!note.updatedAt) return "";
  const date = note.updatedAt.toDate();
  return `更新日：${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export default function VisitPanel({
  facility,
  store,
  visits,
  visitsLoading = false,
  visitError = "",
  photoStore,
  mark,
  markStore,
  markLoadError = "",
  note,
  noteStore,
  notesLoading = false,
  noteLoadError = "",
  customFacilityStore,
  onEditFacility,
  onEditingChange,
  backLabel = "← 施設一覧",
  onShowOnMap = () => undefined,
  onBack,
}: {
  facility: Facility;
  store: VisitStore;
  visits: Visit[];
  visitsLoading?: boolean;
  visitError?: string;
  photoStore?: VisitPhotoStore;
  mark?: Mark;
  markStore?: MarkStore;
  markLoadError?: string;
  note?: FacilityNote;
  noteStore?: FacilityNoteStore;
  notesLoading?: boolean;
  noteLoadError?: string;
  customFacilityStore?: CustomFacilityStore;
  onEditFacility?: () => void;
  onEditingChange?: (editing: boolean) => void;
  backLabel?: string;
  onShowOnMap?: () => void;
  onBack: () => void;
}) {
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [expandedPhotoIds, setExpandedPhotoIds] = useState<Set<string>>(() => new Set());
  const [form, setForm] = useState<VisitFormState>();
  const [noteForm, setNoteForm] = useState<string>();
  const [error, setError] = useState("");
  const [markError, setMarkError] = useState("");
  const [facilityError, setFacilityError] = useState("");
  const [noteError, setNoteError] = useState("");
  const [savingMark, setSavingMark] = useState<MarkFlag>();
  const [saving, setSaving] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const submittingRef = useRef(false);
  const photoPreviewUrlRef = useRef<string | undefined>(undefined);

  function revokePhotoPreview() {
    const previewUrl = photoPreviewUrlRef.current;
    if (!previewUrl) return;
    if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(previewUrl);
    photoPreviewUrlRef.current = undefined;
  }

  const editing = form !== undefined || noteForm !== undefined;

  useEffect(() => {
    onEditingChange?.(editing);
    return () => onEditingChange?.(false);
  }, [editing, onEditingChange]);

  useEffect(() => () => {
    const previewUrl = photoPreviewUrlRef.current;
    if (!previewUrl) return;
    if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(previewUrl);
    photoPreviewUrlRef.current = undefined;
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!photoStore || !visits) {
      setPhotoUrls({});
      return () => { cancelled = true; };
    }
    setPhotoUrls({});
    visits.filter((visit) => visit.photoPath).forEach((visit) => {
      photoStore.getUrl(visit.photoPath!).then((url) => {
        if (!cancelled) {
          setPhotoUrls((current) => ({ ...current, [visit.id]: url }));
        }
      }).catch(() => undefined);
    });
    return () => { cancelled = true; };
  }, [photoStore, visits]);

  function openNewVisit() {
    revokePhotoPreview();
    setError("");
    setForm({
      id: store.newId(),
      editing: false,
      date: today(),
      rating: "",
      memo: "",
      visitor: "",
      removePhoto: false,
    });
  }

  function togglePhoto(visitId: string) {
    setExpandedPhotoIds((current) => {
      const next = new Set(current);
      if (next.has(visitId)) next.delete(visitId);
      else next.add(visitId);
      return next;
    });
  }

  function openEditVisit(visit: Visit) {
    revokePhotoPreview();
    setError("");
    setForm({
      id: visit.id,
      editing: true,
      date: visit.date,
      rating: visit.rating?.toString() ?? "",
      memo: visit.memo ?? "",
      visitor: visit.visitor ?? "",
      photoPath: visit.photoPath,
      originalPhotoPath: visit.photoPath,
      removePhoto: false,
    });
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_SOURCE_IMAGE_BYTES) {
      event.currentTarget.value = "";
      setError("画像は20MB以下のファイルを選択してください");
      return;
    }
    if (!form) return;
    revokePhotoPreview();
    const previewUrl = typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(file)
      : undefined;
    photoPreviewUrlRef.current = previewUrl;
    setError("");
    setForm({ ...form, photoFile: file, photoPreviewUrl: previewUrl, removePhoto: false });
  }

  async function saveVisit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!form) return;
    if (!form.date) {
      setError("訪問日を入力してください");
      return;
    }
    if (form.memo.length > 2000) {
      setError("メモは2000文字以内で入力してください");
      return;
    }

    setError("");
    submittingRef.current = true;
    setSaving(true);
    let uploadedPhotoPath: string | undefined;
    const previousPhotoPath = form.originalPhotoPath ?? form.photoPath;
    try {
      if (photoStore && form.photoFile && !form.removePhoto) {
        uploadedPhotoPath = await photoStore.upload(form.id, form.photoFile);
      }
      const photoPath = form.removePhoto ? undefined : uploadedPhotoPath ?? form.photoPath;
      const draft: Omit<VisitDraft, "id"> = {
        facilityId: facility.id,
        date: form.date,
        ...(form.rating ? { rating: Number(form.rating) } : {}),
        ...(form.memo ? { memo: form.memo } : {}),
        ...(form.visitor ? { visitor: form.visitor } : {}),
        ...(form.editing
          ? { photoPath }
          : photoPath ? { photoPath } : {}),
      };
      if (form.editing) {
        await store.update(form.id, draft);
      } else {
        await store.create({ id: form.id, ...draft });
      }
      if (photoStore && previousPhotoPath && previousPhotoPath !== photoPath) {
        await photoStore.remove(previousPhotoPath).catch(() => undefined);
      }
      revokePhotoPreview();
      setForm(undefined);
    } catch {
      if (photoStore && uploadedPhotoPath) {
        await photoStore.remove(uploadedPhotoPath).catch(() => undefined);
      }
      setError("記録を保存できませんでした。もう一度お試しください");
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  async function removeVisit(visit: Visit) {
    if (!window.confirm(displayDate(visit.date) + "の記録を削除しますか？")) return;
    setError("");
    try {
      await store.remove(visit.id);
      if (photoStore && visit.photoPath) {
        await photoStore.remove(visit.photoPath).catch(() => undefined);
      }
    } catch {
      setError("記録を削除できませんでした。もう一度お試しください");
    }
  }

  async function toggleMark(flag: MarkFlag) {
    if (!markStore || savingMark) return;
    setMarkError("");
    setSavingMark(flag);
    try {
      await markStore.setFlag(facility.id, flag, !(mark?.[flag] ?? false));
    } catch {
      setMarkError("お気に入り設定を保存できませんでした。もう一度お試しください");
    } finally {
      setSavingMark(undefined);
    }
  }

  function openNoteEditor() {
    setNoteError("");
    setNoteForm(note?.text ?? "");
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteStore || noteForm === undefined || noteSaving) return;
    const text = noteForm.trim();
    if (text.length > MAX_FACILITY_NOTE_LENGTH) {
      setNoteError("施設メモは2000文字以内で入力してください");
      return;
    }

    setNoteError("");
    setNoteSaving(true);
    try {
      await noteStore.save(facility.id, text);
      setNoteForm(undefined);
    } catch {
      setNoteError("施設メモを保存できませんでした。もう一度お試しください");
    } finally {
      setNoteSaving(false);
    }
  }

  async function removeFacility() {
    if (!customFacilityStore || !facility.id.startsWith("custom_")) return;
    if (!window.confirm("この手動追加施設を削除しますか？訪問記録とお気に入り設定は残ります。")) return;
    setFacilityError("");
    try {
      await customFacilityStore.remove(facility.id);
      onBack();
    } catch {
      setFacilityError("施設を削除できませんでした。もう一度お試しください");
    }
  }

  const duplicateDate = form && visits?.some(
    (visit) => visit.id !== form.id && visit.date === form.date,
  );

  return (
    <main className="app-shell detail-shell">
      <header className="detail-hero">
        <button className="back-button" type="button" onClick={onBack}>{backLabel}</button>
        <p className="eyebrow">VISIT FIELD NOTE</p>
        <h1>{facility.name}</h1>
        <p>{facility.address ?? `${facility.pref} ${facility.city}`}</p>
        {facility.note && <p className="facility-note">{facility.note}</p>}
        <div className="detail-hero-links" aria-label="施設情報">
          <button className="facility-map-link" type="button" onClick={onShowOnMap}>地図で場所を見る</button>
          <a className="facility-site-link" href={facility.url} target="_blank" rel="noreferrer">公式サイトを見る ↗</a>
        </div>
        {markStore && (
          <div className="mark-toggles" role="group" aria-label="施設のマーク">
            <button
              type="button"
              aria-pressed={mark?.wishlist === true}
              disabled={savingMark !== undefined}
              onClick={() => toggleMark("wishlist")}
            >♡ 行きたい</button>
            <button
              type="button"
              aria-pressed={mark?.favorite === true}
              disabled={savingMark !== undefined}
              onClick={() => toggleMark("favorite")}
            >★ お気に入り</button>
          </div>
        )}
        {customFacilityStore && facility.id.startsWith("custom_") && (
          <div className="facility-actions">
            {onEditFacility && <button type="button" onClick={onEditFacility}>編集</button>}
            <button type="button" onClick={removeFacility}>この施設を削除</button>
          </div>
        )}
      </header>

      <section className="visit-section" aria-labelledby="visit-heading">
        <div className="visit-heading">
          <div>
            <p>MY LOG</p>
            <h2 id="visit-heading">訪問記録</h2>
          </div>
          {!form && <button type="button" onClick={openNewVisit}>訪問記録を追加</button>}
        </div>

        {visitError && !error && <p className="visit-error" role="alert">{visitError}</p>}
        {error && <p className="visit-error" role="alert">{error}</p>}
        {markLoadError && !markError && <p className="mark-load-error" role="alert">{markLoadError}</p>}
        {markError && <p className="mark-load-error" role="alert">{markError}</p>}
        {facilityError && <p className="visit-error" role="alert">{facilityError}</p>}

        {form && (
          <form className="visit-form" onSubmit={saveVisit} noValidate>
            <div className="form-row">
              <label>
                訪問日
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                />
              </label>
              <label>
                評価
                <select
                  value={form.rating}
                  onChange={(event) => setForm({ ...form, rating: event.target.value })}
                >
                  <option value="">なし</option>
                  <option value="1">★</option>
                  <option value="2">★★</option>
                  <option value="3">★★★</option>
                  <option value="4">★★★★</option>
                  <option value="5">★★★★★</option>
                </select>
              </label>
            </div>
            {duplicateDate && <p className="duplicate-note">同じ日の記録があります。このまま保存できます。</p>}
            <label>
              メモ・感想
              <textarea
                value={form.memo}
                maxLength={2000}
                onChange={(event) => setForm({ ...form, memo: event.target.value })}
                placeholder="印象に残った生きものや出来事"
              />
            </label>
            <label>
              一緒に行った人
              <input
                type="text"
                value={form.visitor}
                maxLength={100}
                onChange={(event) => setForm({ ...form, visitor: event.target.value })}
                placeholder="例：家族"
              />
            </label>
            {photoStore && (
              <div className="visit-photo-field">
                <label htmlFor="visit-photo">訪問写真</label>
                <input
                  id="visit-photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                />
                {form.photoPreviewUrl && !form.removePhoto && (
                  <img
                    className="visit-photo visit-photo-preview"
                    src={form.photoPreviewUrl}
                    alt="選択した訪問写真"
                  />
                )}
                {(form.photoPath || form.photoFile) && !form.removePhoto && (
                  <div className="visit-photo-status">
                    <span>{form.photoFile ? "選択中：" + form.photoFile.name : "写真を登録済み"}</span>
                    <button
                      type="button"
                      onClick={() => {
                        revokePhotoPreview();
                        setForm({
                          ...form,
                          photoFile: undefined,
                          photoPath: undefined,
                          photoPreviewUrl: undefined,
                          removePhoto: true,
                        });
                      }}
                    >写真を外す</button>
                  </div>
                )}
              </div>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  revokePhotoPreview();
                  setForm(undefined);
                }}
              >キャンセル</button>
              <button type="submit" disabled={saving}>
                {saving ? "保存しています…" : form.editing ? "変更を保存" : "記録を保存"}
              </button>
            </div>
          </form>
        )}

        {visitsLoading ? (
          <p className="visit-status">記録を読み込んでいます</p>
        ) : visits.length === 0 ? (
          <div className="visit-empty">
            <span aria-hidden="true">○</span>
            <h3>まだ訪問記録がありません</h3>
            <p>最初の思い出を残してみましょう。</p>
          </div>
        ) : (
          <ul className="visit-list">
            {visits.map((visit) => (
              <li key={visit.id}>
                <div className="visit-date">
                  <strong>{displayDate(visit.date)}</strong>
                  {visit.rating && <span aria-label={"評価" + visit.rating}>{"★".repeat(visit.rating)}</span>}
                </div>
                {visit.memo && <p>{visit.memo}</p>}
                {visit.visitor && <small>一緒に行った人：{visit.visitor}</small>}
                {photoUrls[visit.id] && (
                  <div className="visit-photo-block">
                    <div className={`visit-photo-frame${expandedPhotoIds.has(visit.id) ? " visit-photo-frame--expanded" : ""}`}>
                      <img
                        id={`visit-photo-${visit.id}`}
                        className="visit-photo"
                        src={photoUrls[visit.id]}
                        alt={displayDate(visit.date) + "の訪問写真"}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <button
                      type="button"
                      className="visit-photo-toggle"
                      aria-controls={`visit-photo-${visit.id}`}
                      aria-expanded={expandedPhotoIds.has(visit.id)}
                      onClick={() => togglePhoto(visit.id)}
                    >{expandedPhotoIds.has(visit.id) ? "閉じる" : "続きを見る"}</button>
                  </div>
                )}
                <div className="visit-actions">
                  <button
                    type="button"
                    aria-label={displayDate(visit.date) + "の記録を編集"}
                    onClick={() => openEditVisit(visit)}
                  >編集</button>
                  <button
                    type="button"
                    aria-label={displayDate(visit.date) + "の記録を削除"}
                    onClick={() => removeVisit(visit)}
                  >削除</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {noteStore && (
        <section className="facility-user-note-section" aria-labelledby="facility-user-note-heading">
          <div className="visit-heading">
            <div>
              <p>FACILITY NOTE</p>
              <h2 id="facility-user-note-heading">施設メモ</h2>
            </div>
            {!noteForm && !notesLoading && !noteLoadError && (
              <button type="button" onClick={openNoteEditor}>{note ? "編集" : "メモを追加"}</button>
            )}
            {!noteForm && noteLoadError && (
              <button type="button" disabled>{note ? "編集" : "メモを追加"}</button>
            )}
          </div>

          {notesLoading && <p className="facility-user-note-status">メモを読み込んでいます</p>}
          {noteLoadError && <p className="visit-error" role="alert">メモを読み込めませんでした</p>}
          {noteError && <p className="visit-error" role="alert">{noteError}</p>}

          {noteForm !== undefined ? (
            <form className="visit-form" onSubmit={saveNote} noValidate>
              <label>
                施設メモ
                <textarea
                  value={noteForm}
                  maxLength={MAX_FACILITY_NOTE_LENGTH}
                  onChange={(event) => setNoteForm(event.target.value)}
                  placeholder="駐車場・持ち物・次回行きたい場所など"
                />
              </label>
              <div className="form-actions">
                <button type="button" className="secondary" onClick={() => {
                  setNoteError("");
                  setNoteForm(undefined);
                }}>キャンセル</button>
                <button type="submit" disabled={noteSaving}>{noteSaving ? "保存しています…" : "保存"}</button>
              </div>
            </form>
          ) : note ? (
            <div className="facility-user-note-card">
              <p className="facility-user-note-text">{note.text}</p>
              {displayNoteUpdatedAt(note) && <small>{displayNoteUpdatedAt(note)}</small>}
            </div>
          ) : !notesLoading && !noteLoadError ? (
            <p className="facility-user-note-status">施設メモはありません</p>
          ) : null}
        </section>
      )}
    </main>
  );
}
