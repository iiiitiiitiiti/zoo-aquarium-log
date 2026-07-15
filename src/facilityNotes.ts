import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Firestore,
  type Timestamp,
} from "firebase/firestore";

export const MAX_FACILITY_NOTE_LENGTH = 2000;

export interface FacilityNote {
  text: string;
  updatedAt: Timestamp | null;
}

export type FacilityNoteMap = Record<string, FacilityNote>;

export interface FacilityNoteStore {
  save(facilityId: string, text: string): Promise<void>;
  subscribe(onNotes: (notes: FacilityNoteMap) => void, onError: (error: Error) => void): () => void;
}

export class FirestoreFacilityNoteStore implements FacilityNoteStore {
  constructor(
    private readonly db: Firestore,
    private readonly householdUid: string,
  ) {}

  private notesCollection() {
    return collection(this.db, "households", this.householdUid, "facilityNotes");
  }

  async save(facilityId: string, text: string) {
    const normalizedText = text.trim();
    if (normalizedText.length > MAX_FACILITY_NOTE_LENGTH) {
      throw new Error("施設メモは2000文字以内で入力してください");
    }

    const noteRef = doc(this.notesCollection(), facilityId);
    if (!normalizedText) {
      await deleteDoc(noteRef);
      return;
    }

    await setDoc(noteRef, {
      text: normalizedText,
      updatedAt: serverTimestamp(),
    });
  }

  subscribe(onNotes: (notes: FacilityNoteMap) => void, onError: (error: Error) => void) {
    return onSnapshot(
      this.notesCollection(),
      (snapshot) => {
        const notes: FacilityNoteMap = {};
        snapshot.docs.forEach((noteDoc) => {
          const data = noteDoc.data();
          if (typeof data.text !== "string") return;
          notes[noteDoc.id] = {
            text: data.text,
            updatedAt: (data.updatedAt as Timestamp | null | undefined) ?? null,
          };
        });
        onNotes(notes);
      },
      onError,
    );
  }
}
