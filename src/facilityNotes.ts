import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Firestore,
  type Timestamp,
} from "firebase/firestore";

export const MAX_FACILITY_NOTE_LENGTH = 2000;

export interface FacilityNote {
  id: string;
  facilityId: string;
  text: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface FacilityNoteRecord {
  id: string;
  facilityId?: string;
  text: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type FacilityNoteMap = Record<string, FacilityNote[]>;

export interface FacilityNoteStore {
  create(facilityId: string, text: string): Promise<void>;
  update(noteId: string, facilityId: string, text: string): Promise<void>;
  remove(noteId: string): Promise<void>;
  subscribe(onNotes: (notes: FacilityNoteMap) => void, onError: (error: Error) => void): () => void;
}

export function normalizeFacilityNoteText(text: string) {
  const normalizedText = text.trim();
  if (normalizedText.length > MAX_FACILITY_NOTE_LENGTH) {
    throw new Error("施設メモは2000文字以内で入力してください");
  }
  return normalizedText;
}

export function groupFacilityNotes(records: FacilityNoteRecord[]): FacilityNoteMap {
  const grouped: FacilityNoteMap = {};
  records.forEach((record) => {
    const facilityId = record.facilityId ?? record.id;
    const note: FacilityNote = {
      id: record.id,
      facilityId,
      text: record.text,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    grouped[facilityId] ??= [];
    grouped[facilityId].push(note);
  });
  Object.values(grouped).forEach((notes) => {
    notes.sort((a, b) => {
      const updatedA = a.updatedAt?.toMillis() ?? 0;
      const updatedB = b.updatedAt?.toMillis() ?? 0;
      return updatedB - updatedA || b.id.localeCompare(a.id);
    });
  });
  return grouped;
}

export class FirestoreFacilityNoteStore implements FacilityNoteStore {
  constructor(
    private readonly db: Firestore,
    private readonly householdUid: string,
  ) {}

  private notesCollection() {
    return collection(this.db, "households", this.householdUid, "facilityNotes");
  }

  async create(facilityId: string, text: string) {
    const normalizedText = normalizeFacilityNoteText(text);
    if (!normalizedText) return;
    await addDoc(this.notesCollection(), {
      facilityId,
      text: normalizedText,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async update(noteId: string, facilityId: string, text: string) {
    const normalizedText = normalizeFacilityNoteText(text);
    const noteRef = doc(this.notesCollection(), noteId);
    if (!normalizedText) {
      await deleteDoc(noteRef);
      return;
    }
    await updateDoc(noteRef, {
      facilityId,
      text: normalizedText,
      updatedAt: serverTimestamp(),
    });
  }

  async remove(noteId: string) {
    await deleteDoc(doc(this.notesCollection(), noteId));
  }

  subscribe(onNotes: (notes: FacilityNoteMap) => void, onError: (error: Error) => void) {
    return onSnapshot(
      this.notesCollection(),
      (snapshot) => {
        const records: FacilityNoteRecord[] = [];
        snapshot.docs.forEach((noteDoc) => {
          const data = noteDoc.data();
          if (typeof data.text !== "string") return;
          records.push({
            id: noteDoc.id,
            facilityId: typeof data.facilityId === "string" ? data.facilityId : undefined,
            text: data.text,
            createdAt: (data.createdAt as Timestamp | null | undefined) ?? null,
            updatedAt: (data.updatedAt as Timestamp | null | undefined) ?? null,
          });
        });
        onNotes(groupFacilityNotes(records));
      },
      onError,
    );
  }
}
