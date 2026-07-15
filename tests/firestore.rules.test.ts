import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, test } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const PROJECT_ID = "demo-zoo-aquarium-log";
const HOUSEHOLD_UID = "cbs9TeeZukMBRkHg5iIw9aMXw1W2";
const OTHER_UID = "another-household";

let testEnv: RulesTestEnvironment;

const validVisit = () => ({
  facilityId: "tokyo-ueno-zoo",
  date: "2026-07-13",
  rating: 5,
  memo: "家族で訪問しました 🐼",
  visitor: "家族",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Firestore household rules", () => {
  test("世帯アカウントは正しい訪問記録を保存できる", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const visitRef = doc(db, "households", HOUSEHOLD_UID, "visits", "visit-1");

    await assertSucceeds(setDoc(visitRef, validVisit()));
  });

  test("訪問写真のパスを保存でき、長すぎるパスは拒否する", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const visits = collection(db, "households", HOUSEHOLD_UID, "visits");

    await assertSucceeds(setDoc(doc(visits), {
      ...validVisit(),
      photoPath: "households/" + HOUSEHOLD_UID + "/visits/visit-1/photo.webp",
    }));
    await assertFails(setDoc(doc(visits), {
      ...validVisit(),
      photoPath: "p".repeat(301),
    }));
  });

  test("未認証ユーザーの読み書きを拒否する", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const visitRef = doc(db, "households", HOUSEHOLD_UID, "visits", "visit-1");

    await assertFails(getDoc(visitRef));
    await assertFails(setDoc(visitRef, validVisit()));
  });

  test("別UIDから世帯データへのアクセスを拒否する", async () => {
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    const visitRef = doc(db, "households", HOUSEHOLD_UID, "visits", "visit-1");

    await assertFails(getDoc(visitRef));
    await assertFails(setDoc(visitRef, validVisit()));
  });

  test("collection group queryを拒否する", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "households", HOUSEHOLD_UID, "visits", "visit-1"),
        { ...validVisit(), createdAt: new Date(), updatedAt: new Date() },
      );
    });
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();

    await assertFails(getDocs(collectionGroup(db, "visits")));
  });

  test("不正なフィールドを含む訪問記録を拒否する", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const visitRef = doc(collection(db, "households", HOUSEHOLD_UID, "visits"));

    await assertFails(setDoc(visitRef, { ...validVisit(), owner: "attacker" }));
  });

  test("2000文字を超えるメモを拒否する", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const visitRef = doc(collection(db, "households", HOUSEHOLD_UID, "visits"));

    await assertFails(setDoc(visitRef, { ...validVisit(), memo: "あ".repeat(2001) }));
  });

  test("評価範囲外と作成日時の改ざんを拒否する", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const visits = collection(db, "households", HOUSEHOLD_UID, "visits");

    await assertFails(setDoc(doc(visits), { ...validVisit(), rating: 0 }));
    await assertFails(setDoc(doc(visits), { ...validVisit(), createdAt: new Date(0) }));
  });

  test("行きたい・お気に入りはbooleanだけ許可する", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const validRef = doc(db, "households", HOUSEHOLD_UID, "marks", "tokyo-ueno-zoo");
    const invalidRef = doc(db, "households", HOUSEHOLD_UID, "marks", "other-zoo");

    await assertSucceeds(setDoc(validRef, { wishlist: true, favorite: false }));
    await assertFails(setDoc(invalidRef, { wishlist: "yes", favorite: false }));
  });

  test("手動施設のID一致とsourceUrls要素型を検証する", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const customFacility = {
      id: "custom_family_zoo",
      name: "家族動物園",
      kana: "かぞくどうぶつえん",
      pref: "東京都",
      city: "台東区",
      type: "zoo",
      lat: 35.7,
      lng: 139.7,
      url: "https://example.com/",
      sourceUrls: ["https://example.com/"],
      status: "open",
      lastVerifiedAt: "2026-07-13",
    };

    await assertSucceeds(setDoc(
      doc(db, "households", HOUSEHOLD_UID, "customFacilities", customFacility.id),
      customFacility,
    ));
    await assertFails(setDoc(
      doc(db, "households", HOUSEHOLD_UID, "customFacilities", "custom_wrong_id"),
      customFacility,
    ));
    await assertFails(setDoc(
      doc(db, "households", HOUSEHOLD_UID, "customFacilities", "custom_bad_source"),
      { ...customFacility, id: "custom_bad_source", sourceUrls: [123] },
    ));
  });

  test("手動施設の任意の住所は1〜200文字だけ許可する", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const customFacility = {
      id: "custom_addressed_zoo",
      name: "住所つき動物園",
      kana: "じゅうしょつきどうぶつえん",
      pref: "東京都",
      city: "台東区",
      type: "zoo",
      lat: 35.7,
      lng: 139.7,
      url: "https://example.com/",
      sourceUrls: ["https://example.com/"],
      status: "open",
      lastVerifiedAt: "2026-07-15",
    };
    const facilityRef = doc(db, "households", HOUSEHOLD_UID, "customFacilities", customFacility.id);

    await assertSucceeds(setDoc(facilityRef, { ...customFacility, address: "東京都台東区上野公園9-83" }));
    await assertSucceeds(setDoc(facilityRef, customFacility));
    await assertFails(setDoc(facilityRef, { ...customFacility, address: "" }));
    await assertFails(setDoc(facilityRef, { ...customFacility, address: "あ".repeat(201) }));
    await assertFails(setDoc(facilityRef, { ...customFacility, address: 123 }));
  });

  test("施設メモはserverTimestampと2000文字境界を検証し、削除を許可する", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const notes = collection(db, "households", HOUSEHOLD_UID, "facilityNotes");
    const noteRef = doc(notes, "tokyo-ueno-zoo");

    await assertSucceeds(setDoc(noteRef, { text: "家族メモ", updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(noteRef));
    await assertFails(setDoc(doc(notes, "empty"), { text: "", updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(notes, "space"), { text: " ", updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(notes, "ascii-2000"), { text: "a".repeat(2000), updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(notes, "ascii-2001"), { text: "a".repeat(2001), updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(notes, "emoji-1000"), { text: "🐼".repeat(1000), updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(notes, "emoji-1001"), { text: "🐼".repeat(1001), updatedAt: serverTimestamp() }));
  });

  test("施設メモの不正フィールド・時刻改ざん・別UIDを拒否する", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();
    const noteRef = doc(db, "households", HOUSEHOLD_UID, "facilityNotes", "tokyo-ueno-zoo");

    await assertFails(setDoc(noteRef, {
      text: "家族メモ",
      updatedAt: serverTimestamp(),
      owner: "attacker",
    }));
    await assertFails(setDoc(noteRef, { text: "家族メモ", updatedAt: new Date() }));

    const otherDb = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(setDoc(
      doc(otherDb, "households", HOUSEHOLD_UID, "facilityNotes", "tokyo-ueno-zoo"),
      { text: "家族メモ", updatedAt: serverTimestamp() },
    ));
  });

  test("未定義のサブコレクションは拒否する", async () => {
    const db = testEnv.authenticatedContext(HOUSEHOLD_UID).firestore();

    await assertFails(setDoc(
      doc(db, "households", HOUSEHOLD_UID, "privateNotes", "note-1"),
      { text: "許可されていないデータ" },
    ));
  });
});
