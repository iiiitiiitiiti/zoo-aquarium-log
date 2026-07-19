import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// styles.css は可読性のため整形済み。既存の期待文字列（圧縮形式）と
// 比較できるよう、コメント除去と空白圧縮で最小化してから検証する
const styles = readFileSync("src/styles.css", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s+/g, " ")
  .replace(/\s*([{};,])\s*/g, "$1")
  .replace(/: /g, ":")
  .replace(/;}/g, "}")
  .replace(/@media \(/g, "@media(");

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
    expect(styles).toMatch(/\.facility-card\{[^}]*transition:background-color 0\.2s ease/);
    expect(styles).toContain("@media(hover:hover) and (pointer:fine){.facility-card:hover{background:#eaf5ef}}");
    expect(styles).not.toMatch(/(^|\})\.facility-card:hover\{background:#eaf5ef\}/);
  });

  it("keeps visit date and rating controls side by side on narrow screens", () => {
    expect(styles).toContain(
      ".form-row{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,0.8fr);gap:10px}",
    );
    expect(styles).toMatch(/\.visit-form input,\.visit-form select,\.visit-form textarea\{[^}]*min-width:0/);
    expect(styles).toContain(".form-row label{min-width:0}");
  });

  it("keeps iOS native date and select controls inside their columns", () => {
    expect(styles).toContain(
      '@supports (-webkit-touch-callout:none){.visit-form input[type="date"],.visit-form select{-webkit-appearance:none;appearance:none;max-width:100%}',
    );
  });

  it("left-aligns the visit date text on iOS", () => {
    expect(styles).toContain('.visit-form input[type="date"]{text-align:left}');
    expect(styles).toContain(
      '.visit-form input[type="date"]::-webkit-date-and-time-value{text-align:left}',
    );
  });

  it("keeps the facility count heading compact", () => {
    expect(styles).toContain(".results-heading h2{margin:0;font-size:16px}");
  });

  it("animates the facility search accordion", () => {
    expect(styles).toContain(".controls-body{max-height:0;opacity:0;");
    expect(styles).toContain(".controls.is-open .controls-body{max-height:720px;opacity:1;");
  });

  it("styles the filter reset button", () => {
    expect(styles).toContain(".filter-reset{width:100%;margin-top:16px;");
    expect(styles).toContain(".filter-reset:disabled{cursor:not-allowed;opacity:0.45}");
  });

  it("makes selected mark toggles visually obvious", () => {
    expect(styles).toContain(
      '.mark-toggles button[aria-pressed="true"]{border-color:#2f6b50;background:#fff;color:#2f6b50}',
    );
  });

  it("styles the collapsed quick actions", () => {
    expect(styles).toContain(".quick-actions{margin:16px 16px 0;border:1px solid #d7ddd5;border-radius:16px");
    expect(styles).toContain(".quick-actions-summary{display:flex;align-items:center;justify-content:space-between");
    expect(styles).toContain('.controls-summary:after,.quick-actions-summary:after{content:"＋";color:#2a7180;font:400 20px/1 "LINE Seed JP",sans-serif}');
    expect(styles).toContain('.controls.is-open .controls-summary:after,.quick-actions.is-open .quick-actions-summary:after{content:"−"}');
    expect(styles).toContain(".quick-actions-body{max-height:0;opacity:0;");
    expect(styles).toContain(".quick-actions.is-open .quick-actions-body{max-height:220px;opacity:1;");
    expect(styles).toContain(".quick-action:disabled{cursor:not-allowed;opacity:0.45}");
  });

  it("gives controls, quick actions, and facility cards the same radius", () => {
    expect(styles).toContain(".controls,.facility-card,.quick-actions{border-radius:16px}");
    expect(styles).toMatch(/\.facility-card\{[^}]*border-radius:16px/);
    expect(styles).toMatch(/\.quick-actions\{[^}]*border-radius:16px/);
  });

  it("hovers the collapsed accordions like facility cards on pointer devices", () => {
    expect(styles).toContain(".controls-summary,.quick-actions-summary{transition:background-color 0.2s ease}");
    expect(styles).toContain("@media(hover:hover) and (pointer:fine){.controls:not(.is-open) .controls-summary:hover,.quick-actions:not(.is-open) .quick-actions-summary:hover{background:#eaf5ef}}");
  });

  it("uses the app-level animation preference instead of the system setting", () => {
    expect(styles).toContain('html[data-animations="off"]{scroll-behavior:auto !important}');
    expect(styles).toContain('html[data-animations="off"] *,html[data-animations="off"] *::before,html[data-animations="off"] *::after{animation:none !important;transition:none !important}');
    expect(styles).not.toContain("prefers-reduced-motion");
  });

});
