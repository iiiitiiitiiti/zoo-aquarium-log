import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({ base: "/zoo-aquarium-log/", plugins: [react()], test: { environment: "jsdom", setupFiles: "./src/testSetup.ts", include: ["src/**/*.test.{ts,tsx}"], testTimeout: 10000 } });
