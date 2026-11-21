import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { browserFamily, cleanPath, cleanProps, referrerDomain } from "@/lib/analytics";

describe("anonymous analytics privacy rules", () => {
  it("paths lose query strings, ids, tokens and plates", () => {
    expect(cleanPath("/valuation/0e772a7c-7dab-4a8a-bfd6-04c0c56d294c?session_id=cs_live_abc")).toBe("/valuation/:id");
    expect(cleanPath("/shared/abcdefghijklmnopqrstuvwxyz123456")).toBe("/shared/:token");
    expect(cleanPath("/value/ford-kuga#faq")).toBe("/value/ford-kuga");
    expect(cleanPath("/x/LL13JRX")).toBe("/x/:x");
  });
  it("properties never carry emails or registration plates", () => {
    expect(cleanProps({ a: "me@example.com", b: "LL13 JRX viewed", c: 5, d: true, "Bad Key": "x", e: null })).toEqual({ a: "[x]", b: "[x] viewed", c: 5, d: true });
    expect(Object.keys(cleanProps(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i])))).length).toBe(12);
  });
  it("referrer is a hostname only and own site is dropped", () => {
    expect(referrerDomain("https://www.facebook.com/some/path?id=1", "valu8.uk")).toBe("facebook.com");
    expect(referrerDomain("https://valu8.uk/faq", "valu8.uk")).toBeNull();
    expect(referrerDomain("", "valu8.uk")).toBeNull();
  });
  it("browser is a coarse family, never the UA string", () => {
    expect(browserFamily("Mozilla/5.0 (iPhone) AppleWebKit Version/17 Safari/605")).toBe("safari");
    expect(browserFamily("Mozilla/5.0 Chrome/120 Safari/537 Edg/120")).toBe("edge");
  });
  it("the client never touches cookies or storage, and the table has no read access for anon", () => {
    for (const f of ["src/lib/analytics.ts", "src/components/SiteAnalytics.tsx"]) {
      const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(src, f).not.toMatch(/document\.cookie|localStorage|sessionStorage|indexedDB|canvas|fingerprint/i);
    }
    const sql = readFileSync("supabase/migrations/20261122000000_site_events.sql", "utf8");
    expect(sql).toContain("revoke all on public.site_events from anon, authenticated;");
    expect(sql).not.toMatch(/for select/i);
  });
  it("is mounted once in the app and the privacy page says so", () => {
    expect(readFileSync("src/App.tsx", "utf8")).toContain("<SiteAnalytics />");
    expect(readFileSync("src/pages/Privacy.tsx", "utf8")).toContain("Anonymous usage analytics");
  });
});
