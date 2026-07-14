import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  type Firestore,
} from "firebase/firestore";

export type MarkFlag = "wishlist" | "favorite";

export interface Mark {
  wishlist: boolean;
  favorite: boolean;
}

export type MarkMap = Record<string, Mark>;

export interface MarkStore {
  setFlag(facilityId: string, flag: MarkFlag, value: boolean): Promise<void>;
  subscribe(onMarks: (marks: MarkMap) => void, onError: (error: Error) => void): () => void;
}

export class FirestoreMarkStore implements MarkStore {
  constructor(
    private readonly db: Firestore,
    private readonly householdUid: string,
  ) {}

  private marksCollection() {
    return collection(this.db, "households", this.householdUid, "marks");
  }

  async setFlag(facilityId: string, flag: MarkFlag, value: boolean) {
    const markRef = doc(this.marksCollection(), facilityId);
    await runTransaction(this.db, async (transaction) => {
      const snapshot = await transaction.get(markRef);
      const existing = snapshot.exists() ? snapshot.data() : undefined;
      const mark: Mark = {
        wishlist: existing?.wishlist === true,
        favorite: existing?.favorite === true,
        [flag]: value,
      };
      if (!mark.wishlist && !mark.favorite) {
        transaction.delete(markRef);
      } else {
        transaction.set(markRef, mark);
      }
    });
  }

  subscribe(onMarks: (marks: MarkMap) => void, onError: (error: Error) => void) {
    return onSnapshot(
      this.marksCollection(),
      (snapshot) => {
        const marks: MarkMap = {};
        snapshot.docs.forEach((markDoc) => {
          const data = markDoc.data();
          marks[markDoc.id] = {
            wishlist: data.wishlist === true,
            favorite: data.favorite === true,
          };
        });
        onMarks(marks);
      },
      onError,
    );
  }
}
