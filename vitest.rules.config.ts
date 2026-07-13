import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["tests/firestore.rules.test.ts", "tests/visits.integration.test.ts"],
    testTimeout: 15_000,
  },
});
