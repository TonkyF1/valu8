// Minimal robots.txt parser: groups by user-agent, longest-match Allow/Disallow, Crawl-delay.

export interface RobotsRules { allow: string[]; disallow: string[]; crawlDelay: number | null }

export function parseRobots(text: string, agent: string): RobotsRules {
  const groups: { agents: string[]; rules: RobotsRules }[] = [];
  let cur: { agents: string[]; rules: RobotsRules } | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const val = line.slice(i + 1).trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: { allow: [], disallow: [], crawlDelay: null } }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (key === "allow" && val) cur.rules.allow.push(val);
    else if (key === "disallow" && val) cur.rules.disallow.push(val);
    else if (key === "crawl-delay") { const n = Number(val); if (Number.isFinite(n) && n >= 0) cur.rules.crawlDelay = n; }
  }
  const a = agent.toLowerCase();
  const own = groups.filter((g) => g.agents.some((x) => x !== "*" && a.includes(x)));
  const pick = own.length ? own : groups.filter((g) => g.agents.includes("*"));
  const out: RobotsRules = { allow: [], disallow: [], crawlDelay: null };
  for (const g of pick) {
    out.allow.push(...g.rules.allow); out.disallow.push(...g.rules.disallow);
    if (g.rules.crawlDelay != null) out.crawlDelay = Math.max(out.crawlDelay ?? 0, g.rules.crawlDelay);
  }
  return out;
}

function matchLen(pattern: string, path: string): number {
  const anchored = pattern.endsWith("$");
  const p = anchored ? pattern.slice(0, -1) : pattern;
  const re = new RegExp("^" + p.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (anchored ? "$" : ""));
  return re.test(path) ? pattern.length : -1;
}

export function isAllowed(rules: RobotsRules, path: string): boolean {
  let best = -1, allowed = true;
  for (const d of rules.disallow) { const l = matchLen(d, path); if (l > best) { best = l; allowed = false; } }
  for (const al of rules.allow) { const l = matchLen(al, path); if (l >= best && l >= 0) { best = l; allowed = true; } }
  return allowed;
}

/** Price from JSON-LD offers.price or og:price:amount / product:price:amount. Nothing else is read. */
export function extractPrice(html: string): number | null {
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of scripts) {
    try {
      const found = findOfferPrice(JSON.parse(m[1].trim()));
      if (found) return found;
    } catch { /* ignore bad JSON-LD */ }
  }
  const meta = html.match(/<meta[^>]+(?:property|name)=["'](?:og|product):price:amount["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og|product):price:amount["']/i);
  return meta ? toPrice(meta[1]) : null;
}

function toPrice(v: unknown): number | null {
  const n = Number(String(v ?? "").replace(/[£,\s]/g, ""));
  return Number.isFinite(n) && n >= 100 && n < 5_000_000 ? Math.round(n) : null;
}

function findOfferPrice(node: unknown, depth = 0): number | null {
  if (!node || typeof node !== "object" || depth > 6) return null;
  if (Array.isArray(node)) { for (const n of node) { const p = findOfferPrice(n, depth + 1); if (p) return p; } return null; }
  const o = node as Record<string, unknown>;
  if (o.offers) {
    const offers = Array.isArray(o.offers) ? o.offers : [o.offers];
    for (const of of offers) { const p = toPrice((of as any)?.price ?? (of as any)?.lowPrice); if (p) return p; }
  }
  if (o["@graph"]) return findOfferPrice(o["@graph"], depth + 1);
  return null;
}
