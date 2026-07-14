import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc } from "firebase/firestore";
import { FirestoreMarkStore } from "../src/marks";

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

describe("FirestoreMarkStore", () => {
  test("フラグを部分更新し、両方falseでドキュメントを削除する", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const store = new FirestoreMarkStore(db, HOUSEHOLD_UID);
    const markRef = doc(db, "households", HOUSEHOLD_UID, "marks", "tokyo-ueno-zoo");

    await store.setFlag("tokyo-ueno-zoo", "wishlist", true);
    expect((await getDoc(markRef)).data()).toEqual({ wishlist: true, favorite: false });

    await store.setFlag("tokyo-ueno-zoo", "favorite", true);
    expect((await getDoc(markRef)).data()).toEqual({ wishlist: true, favorite: true });

    await store.setFlag("tokyo-ueno-zoo", "wishlist", false);
    expect((await getDoc(markRef)).data()).toEqual({ wishlist: false, favorite: true });

    await store.setFlag("tokyo-ueno-zoo", "favorite", false);
    expect((await getDoc(markRef)).exists()).toBe(false);
  });

  test("購読で全施設のmarksを受け取る", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const store = new FirestoreMarkStore(db, HOUSEHOLD_UID);
    const onMarks = vi.fn();
    const unsubscribe = store.subscribe(onMarks, () => undefined);

    await store.setFlag("tokyo-ueno-zoo", "wishlist", true);
    await vi.waitFor(() => expect(onMarks).toHaveBeenCalledWith({
      "tokyo-ueno-zoo": { wishlist: true, favorite: false },
    }));

    unsubscribe();
  });
});
