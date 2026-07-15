import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc } from "firebase/firestore";
import { FirestoreFacilityNoteStore } from "../src/facilityNotes";

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

describe("FirestoreFacilityNoteStore", () => {
  test("施設メモをtrimして保存し、空で保存すると削除する", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const store = new FirestoreFacilityNoteStore(db, HOUSEHOLD_UID);
    const noteRef = doc(db, "households", HOUSEHOLD_UID, "facilityNotes", "tokyo-ueno-zoo");

    await store.save("tokyo-ueno-zoo", "  駐車場は東園側。\n次回はパンダ舎へ  ");
    expect((await getDoc(noteRef)).data()?.text).toBe("駐車場は東園側。\n次回はパンダ舎へ");

    await store.save("tokyo-ueno-zoo", "   \n  ");
    expect((await getDoc(noteRef)).exists()).toBe(false);
  });

  test("2000文字をJS lengthで検証し、絵文字境界も保存結果へ反映する", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const store = new FirestoreFacilityNoteStore(db, HOUSEHOLD_UID);

    await expect(store.save("emoji-facility", "🐼".repeat(1001))).rejects.toThrow("2000文字以内");
    await store.save("emoji-facility", "🐼".repeat(500));
    expect((await getDoc(doc(db, "households", HOUSEHOLD_UID, "facilityNotes", "emoji-facility"))).data()?.text)
      .toBe("🐼".repeat(500));
  });

  test("購読で全施設のメモを受け取る", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const store = new FirestoreFacilityNoteStore(db, HOUSEHOLD_UID);
    const onNotes = vi.fn();
    const unsubscribe = store.subscribe(onNotes, () => undefined);

    await store.save("tokyo-ueno-zoo", "家族メモ");
    await vi.waitFor(() => expect(onNotes).toHaveBeenCalledWith(expect.objectContaining({
      "tokyo-ueno-zoo": expect.objectContaining({ text: "家族メモ" }),
    })));

    unsubscribe();
  });
});
