import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/styles.css", "utf8");

describe("responsive styles", () => {
  it("reproduces the selected deep-water background direction", () => {
    expect(styles).toContain(
      "background:linear-gradient(150deg,#0b2926 0 42%,#174b52 43% 62%,#286d72 63% 68%,#102e28 69%)",
    );
    expect(styles).toMatch(
      /\.site-stage:before,\.site-stage:after\{[^}]*background:transparent/,
    );
  });

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
