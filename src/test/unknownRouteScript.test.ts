// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getRouteMeta } from "@/data/routeMeta";

const html = readFileSync("index.html", "utf8");
const script = html.match(/<script>\s*(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];

function run(path: string, canonical: string) {
  document.head.innerHTML = `<title>Home</title><link rel="canonical" href="${canonical}" /><meta property="og:url" content="${canonical}" />`;
  window.history.replaceState(null, "", path);
  new Function(script)();
  return {
    canonical: document.querySelector("link[rel=canonical]")?.getAttribute("href") ?? null,
    ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute("content") ?? null,
    robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null,
  };
}

describe("unknown-route head script", () => {
  it("leaves pre-built /value pages indexable with their own canonical", () => {
    expect(run("/value/ford-fiesta/2017", "https://valu8.uk/value/ford-fiesta/2017")).toEqual({
      canonical: "https://valu8.uk/value/ford-fiesta/2017", ogUrl: "https://valu8.uk/value/ford-fiesta/2017", robots: null,
    });
    expect(run("/embed-info", "https://valu8.uk/embed-info").robots).toBeNull();
  });

  it("drops the homepage canonical on real pages served with the homepage shell", () => {
    expect(run("/shared/abc123", "https://valu8.uk/")).toEqual({ canonical: null, ogUrl: null, robots: null });
  });

  it("still marks unknown URLs noindex", () => {
    expect(run("/zzz-bogus", "https://valu8.uk/")).toEqual({ canonical: null, ogUrl: null, robots: "noindex" });
  });
});

describe("routes that used to fall back to homepage metadata", () => {
  it("/buyer points its canonical at /check and is noindex", () => {
    expect(getRouteMeta("/buyer")).toMatchObject({ canonicalPath: "/check", noindex: true });
  });
  it("/unsubscribe and /email-answer are noindex", () => {
    expect(getRouteMeta("/unsubscribe").noindex).toBe(true);
    expect(getRouteMeta("/email-answer").noindex).toBe(true);
  });
});
