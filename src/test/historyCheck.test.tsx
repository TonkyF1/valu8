import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HistoryCheckButton, HISTORY_CHECK_URL, HISTORY_CHECK_DISCLOSURE, HISTORY_CHECK_COUPON_LINE, CARVERTICAL_LOGO, historyCheckHref } from "@/components/report/HistoryCheckButton";

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
  it("shows the disclosure, the carVertical-approved coupon code and their logo, but no invented discount", () => {
    for (const variant of ["card", "line"] as const) {
      const html = renderToStaticMarkup(<HistoryCheckButton registration="BD67USJ" variant={variant} />);
      expect(HISTORY_CHECK_DISCLOSURE).toBe("Affiliate link: Valu8 earns a commission if you buy.");
      expect(html).toContain("Affiliate link: Valu8 earns a commission if you buy.");
      expect(html).toContain("Full vehicle history check");
      expect(HISTORY_CHECK_COUPON_LINE).toBe("Code valu8 is applied automatically.");
      expect(html).toContain(HISTORY_CHECK_COUPON_LINE);
      expect(html).toContain(`src="${CARVERTICAL_LOGO}"`);
      expect(html).toContain('alt="carVertical"');
      expect(html).not.toMatch(/discount|cashback|% off|\bfree check\b/i);
    }
  });
  it("placement goes in sub2 (before the reg in sub3); bad characters are stripped", () => {
    expect(historyCheckHref("bd67 usj", "home_result")).toBe(`${BASE}&sub2=home_result&sub3=BD67USJ`);
    expect(historyCheckHref(null, "value_model")).toBe(`${BASE}&sub2=value_model`);
    expect(historyCheckHref("BD67USJ", "a b&c")).toBe(`${BASE}&sub2=abc&sub3=BD67USJ`);
    const html = renderToStaticMarkup(<HistoryCheckButton registration="BD67USJ" placement="report" />);
    expect(html).toContain("&amp;sub2=report&amp;sub3=BD67USJ");
  });
});

describe("carVertical card placement in Report.tsx", () => {
  const src = require("fs").readFileSync("src/pages/Report.tsx", "utf8") as string;
  const uses = [...src.matchAll(/<HistoryCheckButton\b[^>]*\/>/g)];
  it("has exactly three render sites: the Premium view, locked (free) views and the standard unlocked view", () => {
    expect(uses.length).toBe(3);
    const premiumIdx = src.indexOf('placement={isShared ? "shared" : "report_premium"}');
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
  it("free site comes after Why this price and the unlock block; every site passes only the reg, a placement and the buying title", () => {
    const lockedIdx = src.indexOf("{locked && !valuationUnavailable && <HistoryCheckButton");
    expect(lockedIdx).toBeGreaterThan(src.indexOf('data-testid="why-this-price"'));
    expect(lockedIdx).toBeGreaterThan(src.indexOf("<ReportCheckout valuationId"));
    expect(uses.every((m) => /^<HistoryCheckButton registration=\{v\.registration\} placement=\{isShared \? "shared" : "report(_free|_premium)?"\} title=\{reportIntent === "buying" \? HISTORY_TITLE_BUYING : undefined\} \/>$/.test(m[0]))).toBe(true);
  });
  it("renders the card for a locked view with just the reg", () => {
    const html = renderToStaticMarkup(<HistoryCheckButton registration="LJ13 YVO" />);
    expect(html).toContain('data-testid="history-check"');
    expect(html).toContain("sub3=LJ13YVO");
  });
});
