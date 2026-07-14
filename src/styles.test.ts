import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/styles.css", "utf8");

describe("responsive styles", () => {
  it("uses the approved local habitat photos", () => {
    expect(styles).toContain('url("./assets/zoo-habitat.webp")');
    expect(styles).toContain('url("./assets/aquarium-habitat.webp")');
    expect(styles).toContain("background-color:#102e28");
  });

  it("removes the field-guide artwork and labels", () => {
    expect(styles).not.toContain("field-guide.svg");
    expect(styles).not.toContain("#ece6d7");
    expect(styles).not.toContain("background-size:22px 22px");
    expect(styles).not.toContain('content:"ZOOLOGY / FIELD 01"');
    expect(styles).not.toContain('content:"AQUATIC LIFE / FIELD 02"');
  });

  it("keeps both habitat photos fixed while content scrolls", () => {
    expect(styles).toMatch(
      /\.site-stage:before,\.site-stage:after\{[^}]*position:fixed/,
    );
  });

  it("uses a high-contrast focus indicator for logout", () => {
    expect(styles).toMatch(
      /\.session-button:focus-visible\{[^}]*outline-color:#f7f4e8/,
    );
  });

  it("hides habitat photos at 720px and below", () => {
    expect(styles).toContain(
      "@media(max-width:720px){.site-stage:before,.site-stage:after{display:none}}",
    );
  });
  it("changes facility card background on hover", () => {
    expect(styles).toMatch(/\.facility-card\{[^}]*transition:background-color \.2s ease/);
    expect(styles).toContain(".facility-card:hover{background:#eaf5ef}");
    expect(styles).toContain("@media(prefers-reduced-motion:reduce){.facility-card{transition:none}}");
  });

  it("keeps visit date and rating controls side by side on narrow screens", () => {
    expect(styles).toContain(
      ".form-row{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:10px}",
    );
    expect(styles).toMatch(/\.visit-form input,\.visit-form select,\.visit-form textarea\{[^}]*min-width:0/);
    expect(styles).toContain(".form-row label{min-width:0}");
  });

  it("keeps iOS native date and select controls inside their columns", () => {
    expect(styles).toContain(
      "@supports (-webkit-touch-callout:none){.visit-form input[type=date],.visit-form select{-webkit-appearance:none;appearance:none;max-width:100%}",
    );
  });

  it("left-aligns the visit date text on iOS", () => {
    expect(styles).toContain(".visit-form input[type=date]{text-align:left}");
    expect(styles).toContain(
      ".visit-form input[type=date]::-webkit-date-and-time-value{text-align:left}",
    );
  });

});
