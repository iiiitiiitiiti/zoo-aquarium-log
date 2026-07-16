import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const TIMEOUT_MS = 10000;
const MIN_HOST_INTERVAL_MS = 500;
const MAX_CONCURRENT_HOSTS = 5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * HTTPレスポンスを多値分類する。
 * 2xx かつ response.redirected なら redirected、そうでなければ reachable。
 */
function classifyResponse(response) {
  const status = response.status;
  if (status === 404 || status === 410) return "not_found";
  if (status === 401 || status === 403) return "blocked";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  if (status >= 200 && status < 300) return response.redirected ? "redirected" : "reachable";
  // それ以外の想定外ステータス（3xx解決不可等）は人手確認へ回す
  return "blocked";
}

/**
 * URL1件を1回だけ検査する。HEADが405/501ならGETにフォールバックする。
 */
async function checkUrlOnce(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let response = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (response.status === 405 || response.status === 501) {
      response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    }
    return classifyResponse(response);
  } catch (error) {
    return error?.name === "AbortError" ? "timeout" : "network_error";
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * URL1件を検査する。timeout/network_errorの場合のみ1回リトライする。
 */
export async function checkUrl(url) {
  let result;
  try {
    result = await checkUrlOnce(url);
  } catch {
    result = "network_error";
  }
  if (result === "timeout" || result === "network_error") {
    try {
      result = await checkUrlOnce(url);
    } catch {
      result = "network_error";
    }
  }
  return result;
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * ドメイン単位で直列化しつつ、ドメイン間は同時MAX_CONCURRENT_HOSTSまで並列実行する。
 */
async function checkUrls(urls) {
  const results = new Map();
  const hostGroups = new Map();

  for (const url of urls) {
    const host = hostnameOf(url);
    if (host === null) {
      results.set(url, "network_error");
      continue;
    }
    if (!hostGroups.has(host)) hostGroups.set(host, []);
    hostGroups.get(host).push(url);
  }

  const hosts = [...hostGroups.keys()];
  let cursor = 0;

  async function processHost(host) {
    const hostUrls = hostGroups.get(host);
    for (let i = 0; i < hostUrls.length; i++) {
      if (i > 0) await sleep(MIN_HOST_INTERVAL_MS);
      const classification = await checkUrl(hostUrls[i]);
      results.set(hostUrls[i], classification);
    }
  }

  const workers = Array.from({ length: Math.min(MAX_CONCURRENT_HOSTS, hosts.length) }, async () => {
    while (cursor < hosts.length) {
      const host = hosts[cursor++];
      await processHost(host);
    }
  });
  await Promise.all(workers);

  return results;
}

function parseLimit(argv) {
  const index = argv.indexOf("--limit");
  if (index === -1) return null;
  const value = Number(argv[index + 1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

async function main() {
  const json = await readFile(new URL("../src/data/facilities.json", import.meta.url), "utf8");
  const facilities = JSON.parse(json);

  if (!Array.isArray(facilities) || facilities.length === 0) {
    console.log("施設が0件のためスキップします");
    return;
  }

  const uniqueUrls = [];
  const seen = new Set();
  for (const facility of facilities) {
    const candidates = [facility?.url, ...(Array.isArray(facility?.sourceUrls) ? facility.sourceUrls : [])];
    for (const url of candidates) {
      if (typeof url !== "string" || url === "" || seen.has(url)) continue;
      seen.add(url);
      uniqueUrls.push(url);
    }
  }

  const limit = parseLimit(process.argv.slice(2));
  const targetUrls = limit === null ? uniqueUrls : uniqueUrls.slice(0, limit);

  console.log(`検査対象: ${targetUrls.length}件（ユニークURL全体: ${uniqueUrls.length}件）`);

  const results = await checkUrls(targetUrls);

  const byCategory = { reachable: [], redirected: [], not_found: [], blocked: [], rate_limited: [], server_error: [], timeout: [], network_error: [] };
  for (const [url, category] of results) {
    byCategory[category].push(url);
  }

  console.log("--- サマリ ---");
  for (const category of Object.keys(byCategory)) {
    console.log(`${category}: ${byCategory[category].length}件`);
  }

  console.log("--- 明細（reachable以外） ---");
  for (const category of Object.keys(byCategory)) {
    if (category === "reachable") continue;
    for (const url of byCategory[category]) {
      console.log(`${category}: ${url}`);
    }
  }
}

// Windows では process.argv[1] がバックスラッシュ区切りのため、素の文字列比較だと
// 一致せず main() が走らないまま exit 0 になる（2026-07-16 に偽陰性として発覚）
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
