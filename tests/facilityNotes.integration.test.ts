import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
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
  test("施設メモをtrimして保存し、空で更新すると削除する", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const store = new FirestoreFacilityNoteStore(db, HOUSEHOLD_UID);
    const notes = collection(db, "households", HOUSEHOLD_UID, "facilityNotes");

    await store.create("tokyo-ueno-zoo", "  駐車場は東園側。\n次回はパンダ舎へ  ");
    const snapshot = await getDocs(notes);
    const noteDoc = snapshot.docs.find((item) => item.data().facilityId === "tokyo-ueno-zoo");
    expect(noteDoc?.data().text).toBe("駐車場は東園側。\n次回はパンダ舎へ");

    await store.update(noteDoc!.id, "tokyo-ueno-zoo", "   \n  ");
    expect((await getDocs(notes)).docs.some((item) => item.id === noteDoc!.id)).toBe(false);
  });

  test("2000文字をJS lengthで検証し、絵文字境界も保存結果へ反映する", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const store = new FirestoreFacilityNoteStore(db, HOUSEHOLD_UID);
    const notes = collection(db, "households", HOUSEHOLD_UID, "facilityNotes");

    await expect(store.create("emoji-facility", "🐼".repeat(1001))).rejects.toThrow("2000文字以内");
    await store.create("emoji-facility", "🐼".repeat(500));
    const snapshot = await getDocs(notes);
    const noteDoc = snapshot.docs.find((item) => item.data().facilityId === "emoji-facility");
    expect(noteDoc?.data().text).toBe("🐼".repeat(500));
  });

  test("購読で同一施設の複数メモを受け取る", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const store = new FirestoreFacilityNoteStore(db, HOUSEHOLD_UID);
    const onNotes = vi.fn();
    const unsubscribe = store.subscribe(onNotes, () => undefined);

    await store.create("tokyo-ueno-zoo", "家族メモ");
    await store.create("tokyo-ueno-zoo", "次回メモ");
    await vi.waitFor(() => {
      const latest = onNotes.mock.lastCall?.[0];
      expect(latest?.["tokyo-ueno-zoo"]).toHaveLength(2);
    });

    unsubscribe();
  });

  test("旧形式の施設メモを施設IDとして読み込める", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "households", HOUSEHOLD_UID, "facilityNotes", "legacy-facility"),
        { text: "旧形式メモ", updatedAt: serverTimestamp() },
      );
    });

    const store = new FirestoreFacilityNoteStore(db, HOUSEHOLD_UID);
    const onNotes = vi.fn();
    const unsubscribe = store.subscribe(onNotes, () => undefined);
    await vi.waitFor(() => {
      expect(onNotes.mock.lastCall?.[0]?.["legacy-facility"]).toEqual([
        expect.objectContaining({ facilityId: "legacy-facility", text: "旧形式メモ" }),
      ]);
    });
    unsubscribe();
  });
});
