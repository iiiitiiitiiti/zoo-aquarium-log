import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/styles.css", "utf8");

describe("responsive styles", () => {
  it("uses the approved field-guide background and line art", () => {
    expect(styles).toContain("background-color:#ece6d7");
    expect(styles).toContain('url("./assets/zoo-field-guide.svg")');
    expect(styles).toContain('url("./assets/aquarium-field-guide.svg")');
    expect(styles).toContain('content:"ZOOLOGY / FIELD 01"');
    expect(styles).toContain('content:"AQUATIC LIFE / FIELD 02"');
    expect(styles).not.toContain(
      "linear-gradient(150deg,#0b2926 0 42%,#174b52 43% 62%",
    );
  });

  it("keeps field-guide SVG assets separate from CSS", () => {
    for (const path of [
      "src/assets/zoo-field-guide.svg",
      "src/assets/aquarium-field-guide.svg",
    ]) {
      expect(existsSync(path)).toBe(true);
      expect(readFileSync(path, "utf8")).toContain("<svg");
      expect(readFileSync(path, "utf8")).toContain('fill="none"');
    }
  });

  it("keeps the field-guide background fixed while content scrolls", () => {
    expect(styles).toMatch(
      /\.site-stage\{[^}]*background-attachment:fixed/,
    );
  });

  it("uses a high-contrast focus indicator for logout", () => {
    expect(styles).toMatch(
      /\.session-button:focus-visible\{[^}]*outline-color:#f7f4e8/,
    );
  });

  it("hides the field-guide decorations at 480px and below", () => {
    expect(styles).toContain(
      "@media(max-width:480px){.site-stage:before,.site-stage:after{display:none}}",
    );
  });
});
