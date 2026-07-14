import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import type { Facility } from "./types";

export type CustomFacilityDraft = Omit<Facility, "id">;

export interface CustomFacilityStore {
  create(draft: CustomFacilityDraft): Promise<Facility>;
  update(id: string, draft: CustomFacilityDraft): Promise<Facility>;
  remove(id: string): Promise<void>;
  subscribe(onFacilities: (facilities: Facility[]) => void, onError: (error: Error) => void): () => void;
}

export class FirestoreCustomFacilityStore implements CustomFacilityStore {
  constructor(
    private readonly db: Firestore,
    private readonly householdUid: string,
  ) {}

  private facilitiesCollection() {
    return collection(this.db, "households", this.householdUid, "customFacilities");
  }

  private newId() {
    return "custom_" + doc(this.facilitiesCollection()).id;
  }

  async create(draft: CustomFacilityDraft) {
    const facility: Facility = { id: this.newId(), ...draft };
    await setDoc(doc(this.facilitiesCollection(), facility.id), facility);
    return facility;
  }

  async update(id: string, draft: CustomFacilityDraft) {
    const facility: Facility = { id, ...draft };
    await setDoc(doc(this.facilitiesCollection(), id), facility);
    return facility;
  }

  async remove(id: string) {
    await deleteDoc(doc(this.facilitiesCollection(), id));
  }

  subscribe(onFacilities: (facilities: Facility[]) => void, onError: (error: Error) => void) {
    return onSnapshot(
      this.facilitiesCollection(),
      (snapshot) => {
        const facilities = snapshot.docs
          .map((facilityDoc) => ({ id: facilityDoc.id, ...facilityDoc.data() }) as Facility)
          .sort((a, b) => a.name.localeCompare(b.name, "ja"));
        onFacilities(facilities);
      },
      onError,
    );
  }
}
