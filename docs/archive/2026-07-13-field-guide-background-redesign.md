# Field Guide Background Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Replace only the desktop outer background with the approved field-guide design while preserving every element inside the 480px app shell.

**Architecture:** Store the zoo and aquarium line art as independent SVG assets. Reference them from the existing site-stage pseudo-elements, and replace the deep-water gradient with a fixed cream graph-paper background. Keep the existing 480px mobile breakpoint.

**Tech Stack:** CSS, SVG, Vitest, Vite

## Global Constraints

- Do not modify React components, Firebase, Firestore, facility data, or visit CRUD.
- Keep the app shell at width: min(100%, 480px).
- Keep the background fixed while scrolling.
- Hide the outer line art and labels at 480px and below.
- Do not add animation, photos, emoji, tickets, or stamp collages.

---

### Task 1: Add field-guide assets and replace the desktop background

**Files:**
- Create: src/assets/zoo-field-guide.svg
- Create: src/assets/aquarium-field-guide.svg
- Modify: src/styles.css
- Test: src/styles.test.ts

**Interfaces:**
- Consumes: Existing .site-stage, .site-stage:before, and .site-stage:after CSS selectors.
- Produces: Two standalone SVG assets referenced by CSS and a fixed responsive field-guide background.

- [ ] **Step 1: Write the failing regression tests**

Add asset imports and replace the deep-water-specific test with:

~~~ts
import { existsSync, readFileSync } from "node:fs";

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
~~~

Keep the existing fixed-background, focus-indicator, and 480px breakpoint tests.

- [ ] **Step 2: Run the test and verify RED**

Run: npm test -- --run src/styles.test.ts

Expected: FAIL because the cream background, SVG references, labels, and SVG files do not exist.

- [ ] **Step 3: Create the zoo line-art SVG**

Create src/assets/zoo-field-guide.svg:

~~~svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 720" fill="none">
  <g stroke="#315849" stroke-linecap="round" stroke-linejoin="round">
    <path stroke-width="4" d="M123 642c-10-69-8-144 1-218l14-118c4-35 0-68-18-91-19-25-58-22-68 7-11 33 19 65 54 52 43-16 49-85 77-118 19-22 47-19 57 7 9 23-7 47-29 58-25 12-32 45-27 90 8 78 6 198-7 331M91 642c-8-57-8-111-4-166M180 642c7-56 8-112 3-168M109 311c-28 10-52 4-68-11M187 292c24 10 45 7 60-6"/>
    <path stroke-width="4" d="M187 144c5-28 20-50 43-65M227 79c19 5 32 18 37 37M193 130c-22-13-36-32-39-55M213 185c17 5 30 3 41-6"/>
    <g stroke-width="3">
      <path d="M76 397c14-12 31-12 45 0M137 357c13-10 29-10 42 0M102 481c12-10 27-10 39 0M151 433c11-9 25-9 36 0"/>
      <path d="M36 646c11-73 3-133-24-181M29 549c-23-1-38-13-46-34M38 581c23-8 42-3 56 16M253 646c-3-70 14-129 51-176M276 539c24 2 41-8 52-28M266 580c-22-10-42-7-58 8"/>
      <ellipse cx="204" cy="176" rx="5" ry="4"/>
    </g>
  </g>
</svg>
~~~

- [ ] **Step 4: Create the aquarium line-art SVG**

Create src/assets/aquarium-field-guide.svg:

~~~svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 620" fill="none">
  <g stroke="#267080" stroke-linecap="round" stroke-linejoin="round">
    <path stroke-width="4" d="M35 245c61-77 153-95 233-38 24 17 42 40 54 67-34 42-87 66-147 62-62-4-111-39-140-91Z"/>
    <path stroke-width="4" d="m272 209 55-41-7 81M69 229 20 187l14 78M140 192c17-39 49-66 88-76M145 337c18 41 50 67 91 76"/>
    <path stroke-width="3" d="M96 250c31 16 53 41 63 75M111 207c27 7 54 5 79-5"/>
    <circle cx="233" cy="238" r="7" stroke-width="3"/>
    <path stroke-width="3" d="M39 521c15-69 13-124-5-165M85 521c-2-61 11-111 40-151M145 521c10-53 7-97-10-132M224 521c-6-63 8-112 42-148M285 521c14-57 11-104-10-141"/>
    <path stroke-width="3" d="M34 422c-22-4-38-17-47-39M83 440c24-7 43-2 58 14M220 427c-24-3-41-15-52-35M283 457c20-11 40-10 59 3"/>
    <circle cx="282" cy="112" r="11" stroke-width="3"/><circle cx="304" cy="79" r="6" stroke-width="3"/><circle cx="57" cy="132" r="8" stroke-width="3"/>
  </g>
</svg>
~~~

- [ ] **Step 5: Replace only the site-stage background CSS**

Replace the current deep-water site-stage rules with:

~~~css
.site-stage{position:relative;min-height:100dvh;isolation:isolate;overflow:clip;background-color:#ece6d7;background-image:linear-gradient(#3158490f 1px,transparent 1px),linear-gradient(90deg,#3158490f 1px,transparent 1px);background-size:22px 22px;background-attachment:fixed}.site-stage:before,.site-stage:after{position:fixed;z-index:-1;top:0;bottom:0;width:calc((100vw - 480px)/2);box-sizing:border-box;pointer-events:none;background-repeat:no-repeat;background-position:center 54%;background-size:min(78%,280px) auto;color:#31584999;font:700 8px/1.2 ui-monospace,monospace;letter-spacing:.16em;writing-mode:vertical-rl}.site-stage:before{content:"ZOOLOGY / FIELD 01";left:0;padding:24px 14px;background-image:url("./assets/zoo-field-guide.svg")}.site-stage:after{content:"AQUATIC LIFE / FIELD 02";right:0;padding:24px 14px;background-image:url("./assets/aquarium-field-guide.svg");color:#26708099}
~~~

Keep the existing @media(max-width:480px) rule that hides both pseudo-elements.

- [ ] **Step 6: Run targeted tests and verify GREEN**

Run: npm test -- --run src/styles.test.ts

Expected: 5 tests pass in src/styles.test.ts.

- [ ] **Step 7: Run full verification**

Run:

~~~powershell
npm test -- --run
npm run lint
npm run build
npm run test:data
git diff --check
~~~

Expected: Every command exits successfully.

- [ ] **Step 8: Verify desktop and mobile in Chrome**

At 1200x844, verify:

- shell width is 480px and centered
- zoo and aquarium SVG background images are loaded
- both labels are present
- document scroll width equals viewport width
- background and pseudo-elements stay fixed after scrolling

At 390x844, verify:

- shell width is 390px
- both pseudo-elements are display:none
- document scroll width is 390px

- [ ] **Step 9: Commit**

~~~powershell
git add src/assets/zoo-field-guide.svg src/assets/aquarium-field-guide.svg src/styles.css src/styles.test.ts
git commit -m "style: PC背景を生きもの図鑑デザインへ刷新"
~~~
