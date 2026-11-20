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
