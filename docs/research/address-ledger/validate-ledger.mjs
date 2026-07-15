// 住所候補台帳の検証スクリプト（調査完了後に node で実行）
// 使い方: node docs/research/address-ledger/validate-ledger.mjs
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const facilities = JSON.parse(readFileSync(join(root, "src", "data", "facilities.json"), "utf8"));
const byId = new Map(facilities.map((f) => [f.id, f]));

const teamFiles = readdirSync(here).filter((f) => /^address-team\d+\.json$/.test(f)).sort();
const records = teamFiles.flatMap((f) => JSON.parse(readFileSync(join(here, f), "utf8")));

const errors = [];
const warnings = [];
const seen = new Set();
const confidences = { high: 0, medium: 0, unconfirmed: 0 };

for (const r of records) {
  const label = `${r.id} ${r.name ?? ""}`;
  const master = byId.get(r.id);
  if (!master) { errors.push(`${label}: マスタに存在しないID`); continue; }
  if (seen.has(r.id)) errors.push(`${label}: 台帳内でIDが重複`);
  seen.add(r.id);
  if (r.name !== master.name) warnings.push(`${label}: 名称がマスタと不一致（${master.name}）`);
  if (!(r.confidence in confidences)) { errors.push(`${label}: confidence が不正（${r.confidence}）`); continue; }
  confidences[r.confidence] += 1;

  if (r.confidence === "unconfirmed") {
    if (r.address !== "") errors.push(`${label}: unconfirmed なのに address が入っている`);
    if (!r.note) warnings.push(`${label}: unconfirmed の理由（note）がない`);
    continue;
  }
  if (typeof r.address !== "string" || r.address.trim() === "") { errors.push(`${label}: address が空`); continue; }
  if (r.address.length > 100) warnings.push(`${label}: address が100文字超（${r.address.length}字）`);
  if (/〒|\d{3}-\d{4}/.test(r.address)) errors.push(`${label}: 郵便番号が混入（${r.address}）`);
  if (/[0-9\-()]{9,}/.test(r.address)) warnings.push(`${label}: 電話番号らしき文字列が混入？（${r.address}）`);
  if (!r.address.startsWith(master.pref)) errors.push(`${label}: address が都道府県（${master.pref}）で始まらない（${r.address}）`);
  if (!r.address.includes(master.city.replace(/(市|町|村|区)$/, ""))) {
    warnings.push(`${label}: address にマスタの市区町村（${master.city}）が含まれない（${r.address}）`);
  }
  if (!/^https?:\/\//.test(r.addressSourceUrl ?? "")) errors.push(`${label}: addressSourceUrl が不正（${r.addressSourceUrl}）`);
  if (master.status === "closed" && !/閉園|閉館/.test(r.note ?? "")) {
    warnings.push(`${label}: 閉園施設だが note に閉園時の所在地である旨がない`);
  }
}

for (const f of facilities) {
  if (!seen.has(f.id)) errors.push(`${f.id} ${f.name}: 台帳にレコードがない`);
}

console.log(`台帳レコード: ${records.length} / マスタ: ${facilities.length}`);
console.log(`confidence 内訳: high=${confidences.high} medium=${confidences.medium} unconfirmed=${confidences.unconfirmed}`);
console.log(`\nエラー: ${errors.length}`);
for (const e of errors) console.log(`  [E] ${e}`);
console.log(`\n警告: ${warnings.length}`);
for (const w of warnings) console.log(`  [W] ${w}`);
process.exit(errors.length > 0 ? 1 : 0);
