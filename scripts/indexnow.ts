// Submits every in-sitemap URL to IndexNow (Bing/Yandex). Usage: `bun scripts/indexnow.ts`
import { ALL_ROUTES, SITE_URL } from "../src/data/routeMeta";

export const INDEXNOW_KEY = "b8e4f2a19c7d4053a6f1e0d9c8b7a654";

export function sitemapUrls(): string[] {
  return ALL_ROUTES.filter((route) => route.inSitemap).map((route) => SITE_URL + route.path);
}

async function main() {
  const host = "valu8.uk";
  const key = INDEXNOW_KEY;
  const keyLocation = `${SITE_URL}/${key}.txt`;
  const urlList = sitemapUrls();
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation, urlList }),
  });
  const body = await res.text();
  console.log(`IndexNow ${res.status} (${urlList.length} URLs)`, body || "(empty)");
  if (res.status !== 200 && res.status !== 202) process.exit(1);
}

if (process.argv[1]?.endsWith("indexnow.ts")) void main();
