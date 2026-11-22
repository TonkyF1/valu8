import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HistoryCheckButton, HISTORY_CHECK_URL, HISTORY_CHECK_DISCLOSURE, historyCheckHref } from "@/components/report/HistoryCheckButton";

const BASE = "https://www.carvertical.deal/4BZC6ZM/5DKLH2/?uid=22&source_id=AFF&sub1=valu8";

describe("carVertical history check button", () => {
  it("base link matches the official format", () => {
    expect(HISTORY_CHECK_URL).toBe(BASE);
  });
  it("with a reg: uppercased, whitespace stripped, encoded in sub3", () => {
    expect(historyCheckHref("bd67 usj")).toBe(`${BASE}&sub3=BD67USJ`);
    expect(historyCheckHref(" gc14\thnu ")).toBe(`${BASE}&sub3=GC14HNU`);
    expect(historyCheckHref("A&B 1")).toBe(`${BASE}&sub3=A%26B1`);
    const html = renderToStaticMarkup(<HistoryCheckButton registration="bd67 usj" />);
    expect(html).toContain(`href="${BASE.replace(/&/g, "&amp;")}&amp;sub3=BD67USJ"`);
    expect(html).toContain('target="_blank"');
    expect(html).not.toMatch(/<iframe/i);
  });
  it("without a reg: same link, no sub3", () => {
    for (const r of [undefined, null, "", "   "]) expect(historyCheckHref(r)).toBe(BASE);
    const html = renderToStaticMarkup(<HistoryCheckButton registration={null} />);
    expect(html).toContain(`href="${BASE.replace(/&/g, "&amp;")}"`);
    expect(html).not.toContain("sub3");
  });
  it("rel includes sponsored and noopener", () => {
    const html = renderToStaticMarkup(<HistoryCheckButton registration="BD67USJ" />);
    expect(html).toMatch(/rel="[^"]*\bsponsored\b[^"]*"/);
    expect(html).toMatch(/rel="[^"]*\bnoopener\b[^"]*"/);
  });
  it("shows the disclosure and no discount wording", () => {
    const html = renderToStaticMarkup(<HistoryCheckButton registration="BD67USJ" />);
    expect(HISTORY_CHECK_DISCLOSURE).toBe("Affiliate link: Valu8 earns a commission if you buy.");
    expect(html).toContain("Affiliate link: Valu8 earns a commission if you buy.");
    expect(html).toContain("Full vehicle history check");
    expect(html).not.toMatch(/discount|cashback|% off/i);
  });
});

describe("carVertical card placement in Report.tsx", () => {
  const src = require("fs").readFileSync("src/pages/Report.tsx", "utf8") as string;
  const uses = [...src.matchAll(/<HistoryCheckButton\b[^>]*\/>/g)];
  it("has exactly three render sites: the Premium view, locked (free) views and the standard unlocked view", () => {
    expect(uses.length).toBe(3);
    // Premium site sits inside the premiumView branch (rendered instead of the standard page, never with it).
    const premiumIdx = src.indexOf("<HistoryCheckButton registration={v.registration} />");
    expect(src.lastIndexOf("{premiumView ? (", premiumIdx)).toBeGreaterThan(0);
    expect(src.indexOf(") : (", premiumIdx)).toBeGreaterThan(premiumIdx);
    const lockedIdx = src.indexOf("{locked && !valuationUnavailable && <HistoryCheckButton");
    const unlockedIdx = src.indexOf("{!valuationUnavailable && <HistoryCheckButton");
    expect(lockedIdx).toBeGreaterThan(0);
    expect(unlockedIdx).toBeGreaterThan(lockedIdx);
    // unlocked site sits inside the `!locked` block, so a report never renders both
    expect(src.lastIndexOf("{!locked && (<>", unlockedIdx)).toBeGreaterThan(lockedIdx);
    expect(src.indexOf("</>)}", unlockedIdx)).toBeGreaterThan(unlockedIdx);
  });
  it("free site comes after Why this price and the unlock block, only passes the reg", () => {
    const lockedIdx = src.indexOf("{locked && !valuationUnavailable && <HistoryCheckButton");
    expect(lockedIdx).toBeGreaterThan(src.indexOf('data-testid="why-this-price"'));
    expect(lockedIdx).toBeGreaterThan(src.indexOf("<ReportCheckout valuationId"));
    expect(uses.every((m) => /^<HistoryCheckButton registration=\{v\.registration\} \/>$/.test(m[0]))).toBe(true);
  });
  it("renders the card for a locked view with just the reg", () => {
    const html = renderToStaticMarkup(<HistoryCheckButton registration="LJ13 YVO" />);
    expect(html).toContain('data-testid="history-check"');
    expect(html).toContain("sub3=LJ13YVO");
  });
});
