import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("GitHub Pages workflow builds and deploys the repository base", async()=>{
 const workflow=await readFile(new URL("../.github/workflows/deploy-pages.yml",import.meta.url),"utf8");
 const config=await readFile(new URL("../vite.config.ts",import.meta.url),"utf8");
 assert.match(workflow,/actions\/deploy-pages@v4/); assert.match(workflow,/npm run build/); assert.match(config,/base:\s*["']\/zoo-aquarium-log\/["']/);
});
