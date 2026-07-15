import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/stats.css", "utf8");

describe("statistics navigation styles", () => {
  it("uses the supplied arrow asset in a three-column smooth-scroll layout", () => {
    expect(existsSync("src/assets/Vector.svg")).toBe(true);
    expect(styles).toContain(".stats-anchor-nav{display:grid");
    expect(styles).toContain(".stats-anchor-nav--three-columns{grid-template-columns:repeat(3,minmax(0,1fr))");
    expect(styles).toContain(".stats-anchor-nav{display:grid;gap:8px");
    expect(styles).toContain(".stats-anchor-link{display:flex;align-items:center;justify-content:space-between");
    expect(styles).toContain('.stats-anchor-arrow{display:block;width:14px;height:8px;background:url("./assets/Vector.svg") center/contain no-repeat');
    expect(styles).toContain("html{scroll-behavior:smooth}");
    expect(styles).toContain("@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}");
  });
});
