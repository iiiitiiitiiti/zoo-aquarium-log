import {
  collection,
  deleteField,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
  type Timestamp,
} from "firebase/firestore";

export interface VisitDraft {
  id: string;
  facilityId: string;
  date: string;
  rating?: number;
  memo?: string;
  visitor?: string;
  photoPath?: string;
}

export interface Visit extends VisitDraft {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface VisitStore {
  newId(): string;
  create(draft: VisitDraft): Promise<void>;
  update(id: string, draft: Omit<VisitDraft, "id">): Promise<void>;
  remove(id: string): Promise<void>;
  subscribeAll(
    onVisits: (visits: Visit[]) => void,
    onError: (error: Error) => void,
  ): () => void;
}

function visitFields(draft: Omit<VisitDraft, "id">, deleteMissing = false) {
  return {
    facilityId: draft.facilityId,
    date: draft.date,
    ...(draft.rating === undefined
      ? deleteMissing ? { rating: deleteField() } : {}
      : { rating: draft.rating }),
    ...(draft.memo === undefined
      ? deleteMissing ? { memo: deleteField() } : {}
      : { memo: draft.memo }),
    ...(draft.visitor === undefined
      ? deleteMissing ? { visitor: deleteField() } : {}
      : { visitor: draft.visitor }),
    ...(draft.photoPath === undefined
      ? deleteMissing ? { photoPath: deleteField() } : {}
      : { photoPath: draft.photoPath }),
  };
}

export class FirestoreVisitStore implements VisitStore {
  constructor(
    private readonly db: Firestore,
    private readonly householdUid: string,
  ) {}

  private visitsCollection() {
    return collection(this.db, "households", this.householdUid, "visits");
  }

  newId() {
    return doc(this.visitsCollection()).id;
  }

  async create(draft: VisitDraft) {
    const visitRef = doc(this.visitsCollection(), draft.id);
    await runTransaction(this.db, async (transaction) => {
      const existing = await transaction.get(visitRef);
      if (existing.exists()) return;
      transaction.set(visitRef, {
        ...visitFields(draft),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  async update(id: string, draft: Omit<VisitDraft, "id">) {
    await updateDoc(doc(this.visitsCollection(), id), {
      ...visitFields(draft, true),
      updatedAt: serverTimestamp(),
    });
  }

  async remove(id: string) {
    await deleteDoc(doc(this.visitsCollection(), id));
  }

  subscribeAll(
    onVisits: (visits: Visit[]) => void,
    onError: (error: Error) => void,
  ) {
    return onSnapshot(
      this.visitsCollection(),
      (snapshot) => {
        const visits = snapshot.docs
          .map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() }) as Visit)
          .sort((a, b) => b.date.localeCompare(a.date));
        onVisits(visits);
      },
      onError,
    );
  }
}
