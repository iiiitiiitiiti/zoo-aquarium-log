import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: [
      "tests/firestore.rules.test.ts",
      "tests/storage.rules.test.ts",
      "tests/visits.integration.test.ts",
      "tests/marks.integration.test.ts",
      "tests/facilityNotes.integration.test.ts",
      "tests/customFacilities.integration.test.ts",
    ],
    testTimeout: 15_000,
  },
});
