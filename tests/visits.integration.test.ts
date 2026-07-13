import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc } from "firebase/firestore";
import { FirestoreVisitStore } from "../src/visits";

const PROJECT_ID = "demo-zoo-aquarium-log";
const HOUSEHOLD_UID = "cbs9TeeZukMBRkHg5iIw9aMXw1W2";
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("FirestoreVisitStore", () => {
  test("指定したIDで追加し、作成日時を保ったまま編集して削除できる", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const store = new FirestoreVisitStore(db, HOUSEHOLD_UID);
    const visitRef = doc(db, "households", HOUSEHOLD_UID, "visits", "visit-client-id");

    await store.create({
      id: "visit-client-id",
      facilityId: "tokyo-ueno-zoo",
      date: "2026-07-13",
      rating: 5,
      memo: "最初の記録 🐼",
      visitor: "家族",
    });

    const created = await getDoc(visitRef);
    expect(created.exists()).toBe(true);
    expect(created.data()?.memo).toBe("最初の記録 🐼");
    const createdAt = created.data()?.createdAt;

    await store.create({
      id: "visit-client-id",
      facilityId: "tokyo-ueno-zoo",
      date: "2026-07-13",
      rating: 5,
      memo: "最初の記録 🐼",
      visitor: "家族",
    });
    expect((await getDoc(visitRef)).data()?.createdAt).toEqual(createdAt);

    await store.update("visit-client-id", {
      facilityId: "tokyo-ueno-zoo",
      date: "2026-07-14",
      rating: 4,
      memo: "編集した記録",
      visitor: "家族",
    });

    const updated = await getDoc(visitRef);
    expect(updated.data()?.date).toBe("2026-07-14");
    expect(updated.data()?.createdAt).toEqual(createdAt);

    await store.update("visit-client-id", {
      facilityId: "tokyo-ueno-zoo",
      date: "2026-07-14",
    });
    const cleared = await getDoc(visitRef);
    expect(cleared.data()?.rating).toBeUndefined();
    expect(cleared.data()?.memo).toBeUndefined();
    expect(cleared.data()?.visitor).toBeUndefined();

    await store.remove("visit-client-id");
    expect((await getDoc(visitRef)).exists()).toBe(false);
  });
});
