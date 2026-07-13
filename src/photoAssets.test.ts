import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const photos = [
  {
    path: "src/assets/zoo-habitat.webp",
    credit: "CHUTTERSNAP",
    source: "https://unsplash.com/photos/yjOp7klp6ag",
  },
  {
    path: "src/assets/aquarium-habitat.webp",
    credit: "Matthieu Rochette",
    source: "https://unsplash.com/photos/7zWL4_KHG1s",
  },
];

describe("habitat background photos", () => {
  it.each(photos)(
    "$path is a local WebP no larger than 300KB",
    ({ path }) => {
      expect(existsSync(path)).toBe(true);
      const bytes = readFileSync(path);

      expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
      expect(statSync(path).size).toBeLessThanOrEqual(300_000);
    },
  );

  it("records the photographer and source URL for each photo", () => {
    const credits = readFileSync("src/assets/photo-credits.md", "utf8");

    for (const { credit, source } of photos) {
      expect(credits).toContain(credit);
      expect(credits).toContain(source);
    }
  });
});
