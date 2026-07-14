import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc } from "firebase/firestore";
import { FirestoreCustomFacilityStore, type CustomFacilityDraft } from "../src/customFacilities";

const PROJECT_ID = "demo-zoo-aquarium-log";
const HOUSEHOLD_UID = "cbs9TeeZukMBRkHg5iIw9aMXw1W2";
let testEnv: RulesTestEnvironment;

const draft: CustomFacilityDraft = {
  name: "手動追加パンダ園",
  kana: "しゅどうついかぱんだえん",
  pref: "佐賀県",
  city: "佐賀市",
  type: "zoo",
  lat: 33.2494,
  lng: 130.2988,
  url: "https://example.com/panda",
  sourceUrls: ["https://example.com/panda"],
  status: "open",
  lastVerifiedAt: "2026-07-14",
};

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("FirestoreCustomFacilityStore", () => {
  test("追加・編集・削除できる", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const store = new FirestoreCustomFacilityStore(db, HOUSEHOLD_UID);
    const facility = await store.create(draft);

    expect(facility.id).toMatch(/^custom_[a-zA-Z0-9_-]+$/);
    const ref = doc(db, "households", HOUSEHOLD_UID, "customFacilities", facility.id);
    expect((await getDoc(ref)).data()).toEqual(facility);

    const updated = await store.update(facility.id, { ...draft, name: "編集済みパンダ園" });
    expect(updated.name).toBe("編集済みパンダ園");
    expect((await getDoc(ref)).data()?.name).toBe("編集済みパンダ園");

    await store.remove(facility.id);
    expect((await getDoc(ref)).exists()).toBe(false);
  });

  test("購読でcustom施設を受け取る", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const store = new FirestoreCustomFacilityStore(db, HOUSEHOLD_UID);
    const onFacilities = vi.fn();
    const unsubscribe = store.subscribe(onFacilities, () => undefined);

    const facility = await store.create(draft);
    await vi.waitFor(() => expect(onFacilities).toHaveBeenCalledWith([facility]));

    unsubscribe();
  });
});
