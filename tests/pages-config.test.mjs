import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("GitHub Pages workflow builds and deploys the repository base", async () => {
  const workflow = await readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
  const config = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(styles, /fonts\.googleapis\.com\/css2\?family=LINE\+Seed\+JP/);
  assert.match(styles, /font-family:\s*"LINE Seed JP"/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /npm run build/);
  assert.match(config, /const base = ["']\/zoo-aquarium-log\/["'];/);
  assert.match(config, /VitePWA\(/);
  assert.match(config, /id:\s*base/);
  assert.match(index, /rel="apple-touch-icon" href="%BASE_URL%apple-touch-icon\.png"/);
});

test("スプラッシュは指定アイコンと自然な動きの演出を使う", async () => {
  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(index, /<img[^>]+class="splash-icon"[^>]+src="\.\/assets\/icon\.png"/);
  assert.match(index, /class="splash-orbit splash-orbit-one"/);
  assert.match(index, /class="splash-particle-field"/);
  assert.match(index, /@keyframes splash-icon-reveal/);
  assert.match(index, /@keyframes splash-orbit-spin/);
  assert.match(index, /zoo-aquarium-log:animations-enabled:v1/);
  assert.match(index, /document\.documentElement\.dataset\.animations = enabled \? "on" : "off"/);
  assert.doesNotMatch(index, /prefers-reduced-motion/);
});
