// IndexNow (Bing, Yandex, Seznam, Naver...): tells search engines about new or changed URLs. Free, no account.
// The key file lives at https://valu8.uk/<key>.txt (public/<key>.txt), as the IndexNow spec requires.
//
//   npm run indexnow            submit sitemap URLs not yet submitted (scripts/indexnow-submitted.txt), then record them
//   npm run indexnow -- --all   resubmit every sitemap URL (e.g. after a data refresh changes prices)
//   npm run indexnow -- --dry   print what would be sent, send nothing
//
// Run it after the new pages are live (publish first): engines may fetch the URLs straight away.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { SITE_URL } from "../src/data/routeMeta";
import { ALL_ROUTES } from "../src/data/allRoutes";

export const INDEXNOW_KEY = "b8e4f2a19c7d4053a6f1e0d9c8b7a654";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const SUBMITTED_FILE = "scripts/indexnow-submitted.txt";
const MAX_PER_REQUEST = 10_000; // IndexNow limit

export function sitemapUrls(): string[] {
  return ALL_ROUTES.filter((route) => route.inSitemap).map((route) => SITE_URL + route.path);
}

/** Sitemap URLs not in the already-submitted list. */
export function newUrls(all: string[], submitted: Iterable<string>): string[] {
  const done = new Set(submitted);
  return all.filter((u) => !done.has(u));
}

export function indexNowBody(urlList: string[]) {
  return { host: new URL(SITE_URL).host, key: INDEXNOW_KEY, keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`, urlList };
}

function readSubmitted(): string[] {
  return existsSync(SUBMITTED_FILE) ? readFileSync(SUBMITTED_FILE, "utf8").split("\n").map((s) => s.trim()).filter(Boolean) : [];
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const all = sitemapUrls();
  const submitted = readSubmitted();
  const urls = args.has("--all") ? all : newUrls(all, submitted);
  if (!urls.length) { console.log("IndexNow: nothing new to submit."); return; }
  if (args.has("--dry")) { console.log(`IndexNow dry run: ${urls.length} URLs`); urls.forEach((u) => console.log(u)); return; }
  let ok = true;
  for (let i = 0; i < urls.length; i += MAX_PER_REQUEST) {
    const batch = urls.slice(i, i + MAX_PER_REQUEST);
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(indexNowBody(batch)),
    });
    const body = await res.text();
    console.log(`IndexNow HTTP ${res.status} ${res.statusText} (${batch.length} URLs)`, body || "(empty body)");
    if (res.status !== 200 && res.status !== 202) ok = false;
  }
  if (!ok) process.exit(1);
  const merged = [...new Set([...submitted, ...urls])].filter((u) => all.includes(u) || submitted.includes(u)).sort();
  writeFileSync(SUBMITTED_FILE, merged.join("\n") + "\n");
}

if (process.argv[1]?.endsWith("indexnow.ts")) void main();
