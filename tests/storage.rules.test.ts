import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, test } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

const PROJECT_ID = "demo-zoo-aquarium-log";
const HOUSEHOLD_UID = "cbs9TeeZukMBRkHg5iIw9aMXw1W2";
const OTHER_UID = "another-household";
const PHOTO_PATH = `households/${HOUSEHOLD_UID}/visits/visit-1/photo.webp`;

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      rules: readFileSync("storage.rules", "utf8"),
    },
  });
});

afterEach(async () => {
  await testEnv.clearStorage();
});

afterAll(async () => {
  await testEnv.cleanup();
});

function photoData(size = 4) {
  return Buffer.alloc(size, 0);
}

describe("Storage household rules", () => {
  test("世帯アカウントはWebP写真を保存・読み取り・削除できる", async () => {
    const storage = testEnv.authenticatedContext(HOUSEHOLD_UID).storage();
    const photo = storage.ref(PHOTO_PATH);

    await assertSucceeds(photo.put(photoData(), { contentType: "image/webp" }));
    await assertSucceeds(photo.getMetadata());
    await assertSucceeds(photo.delete());
  });

  test("未認証ユーザーと別UIDは世帯写真へアクセスできない", async () => {
    const ownerStorage = testEnv.authenticatedContext(HOUSEHOLD_UID).storage();
    await assertSucceeds(ownerStorage.ref(PHOTO_PATH).put(photoData(), { contentType: "image/webp" }));

    const unauthenticatedPhoto = testEnv.unauthenticatedContext().storage().ref(PHOTO_PATH);
    const otherPhoto = testEnv.authenticatedContext(OTHER_UID).storage().ref(PHOTO_PATH);
    await assertFails(unauthenticatedPhoto.getMetadata());
    await assertFails(unauthenticatedPhoto.put(photoData(), { contentType: "image/webp" }));
    await assertFails(otherPhoto.getMetadata());
    await assertFails(otherPhoto.delete());
  });

  test("WebP以外の形式と5MB超の写真を拒否する", async () => {
    const storage = testEnv.authenticatedContext(HOUSEHOLD_UID).storage();
    const photoPath = (visitId: string) =>
      `households/${HOUSEHOLD_UID}/visits/${visitId}/photo.webp`;

    await assertSucceeds(
      storage.ref(photoPath("visit-2")).put(photoData(5 * 1024 * 1024), { contentType: "image/webp" }),
    );
    await assertFails(
      storage.ref(photoPath("visit-3")).put(photoData(5 * 1024 * 1024 + 1), { contentType: "image/webp" }),
    );
    await assertFails(
      storage.ref(photoPath("visit-4")).put(photoData(), { contentType: "image/jpeg" }),
    );
  });
});
