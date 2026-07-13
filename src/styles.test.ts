import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/styles.css", "utf8");

describe("responsive styles", () => {
  it("uses a high-contrast focus indicator for logout", () => {
    expect(styles).toMatch(
      /\.session-button:focus-visible\{[^}]*outline-color:#f7f4e8/,
    );
  });

  it("hides the decorative water background at 480px and below", () => {
    expect(styles).toContain(
      "@media(max-width:480px){.site-stage:before,.site-stage:after{display:none}}",
    );
  });
});
